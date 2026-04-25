// NotifyMe — shown on ChatPage when liveCount === 0.
// Subscribes the browser to Web Push so we can nudge the user when
// someone from their college comes online.

import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_APP_WEBSOCKET_URL

// Convert base64url VAPID public key → Uint8Array for PushManager
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw     = atob(base64)
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function NotifyMe({ collegeDomain }) {
    const [state, setState] = useState('idle')  // 'idle' | 'subscribed' | 'denied' | 'loading' | 'error'

    // Check existing permission on mount
    useEffect(() => {
        if (!('Notification' in window)) { setState('unsupported'); return }
        if (Notification.permission === 'denied') setState('denied')
        // Could check localStorage for existing subscription here
    }, [])

    async function handleSubscribe() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setState('unsupported')
            return
        }
        setState('loading')
        try {
            const reg  = await navigator.serviceWorker.ready
            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
            const sub  = await reg.pushManager.subscribe({
                userVisibleOnly:      true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })

            await fetch(`${API}/api/notify/subscribe`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ subscription: sub.toJSON(), collegeDomain: collegeDomain || 'global' }),
            })

            setState('subscribed')
        } catch (err) {
            console.error('[NotifyMe]', err)
            setState(Notification.permission === 'denied' ? 'denied' : 'error')
        }
    }

    if (state === 'subscribed') {
        return (
            <div className="notify-me-wrap">
                <span className="notify-me-icon">🔔</span>
                <span className="notify-me-text">You'll be notified when someone comes online</span>
            </div>
        )
    }

    if (state === 'denied') {
        return (
            <div className="notify-me-wrap notify-me-denied">
                <span className="notify-me-icon">🔕</span>
                <span className="notify-me-text">Notifications blocked — allow them in browser settings</span>
            </div>
        )
    }

    if (state === 'unsupported') return null  // Don't show on unsupported browsers

    return (
        <button
            className={`notify-me-btn${state === 'loading' ? ' loading' : ''}`}
            onClick={handleSubscribe}
            disabled={state === 'loading'}
        >
            <span className="notify-me-icon">🔔</span>
            <span>{state === 'loading' ? 'Setting up…' : 'Notify Me when someone joins'}</span>
        </button>
    )
}
