import { useState, useEffect } from 'react'

const CONNECT_WINDOW = 30

export default function PostCallScreen({ strangerUsername, strangerUserId, socket, onConnect, onMoveOn }) {
    const [timeLeft,       setTimeLeft]       = useState(CONNECT_WINDOW)
    const [connectPressed, setConnectPressed] = useState(false)
    const [bothConnected,  setBothConnected]  = useState(false)

    // ── Server-driven events ─────────────────────────────────
    useEffect(() => {
        if (!socket) return

        socket.on('contactsExchanged', () => setBothConnected(true))

        socket.on('connectExpired', () => {
            // 30s passed, partner didn't press — move on
            onMoveOn()
        })

        socket.on('partnerMovedOn', () => {
            // Partner clicked Move On — close this screen
            onMoveOn()
        })

        return () => {
            socket.off('contactsExchanged')
            socket.off('connectExpired')
            socket.off('partnerMovedOn')
        }
    }, [socket])

    // ── Local countdown (UI only — server enforces real 30s) ─
    useEffect(() => {
        if (connectPressed || bothConnected) return
        if (timeLeft <= 0) {
            handleMoveOn()
            return
        }
        const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000)
        return () => clearTimeout(timer)
    }, [timeLeft, connectPressed, bothConnected])

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

    if (bothConnected) {
        return (
            <div id="postCallScreen">
                <div id="postCall-container">
                    <div id="postCall-success">
                        <span id="postCall-success-emoji">🎉</span>
                        <h2 id="postCall-success-title">You're both connected!</h2>
                        <p id="postCall-success-subtitle">
                            Share how you'd like to stay in touch with {strangerUsername || 'your match'}
                        </p>
                        <div id="contact-options">
                            <button className="contact-btn contact-whatsapp">
                                <span>📱</span> WhatsApp
                            </button>
                            <button className="contact-btn contact-instagram">
                                <span>📸</span> Instagram
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

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
                            {connectPressed ? 'Waiting for them...' : 'Connect 🤝'}
                        </span>
                        {!connectPressed && (
                            <span id="connect-timer">{timeLeft}s</span>
                        )}
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
