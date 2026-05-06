'use client'
import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function NotifyMe({ collegeDomain }) {
  const [state, setState] = useState('idle')

  useEffect(() => {
    if (!('Notification' in window)) { setState('unsupported'); return }
    if (Notification.permission === 'denied') setState('denied')
  }, [])

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return }
    setState('loading')
    try {
      const reg  = await navigator.serviceWorker.ready
      const key  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      const sub  = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
      await fetch(`${API}/api/notify/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), collegeDomain: collegeDomain || 'global' }),
      })
      setState('subscribed')
    } catch {
      setState(Notification.permission === 'denied' ? 'denied' : 'error')
    }
  }

  if (state === 'unsupported') return null
  if (state === 'subscribed') return (
    <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-t3">
      <span>🔔</span>
      <span>You'll be notified when someone comes online</span>
    </div>
  )
  if (state === 'denied') return (
    <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-t3">
      <span>🔕</span>
      <span>Notifications blocked — allow them in browser settings</span>
    </div>
  )

  return (
    <button
      onClick={subscribe}
      disabled={state === 'loading'}
      className="mx-3 my-1.5 flex items-center gap-2 px-4 py-2.5 rounded-sm border border-bdr text-[13px] text-t2 hover:border-accent hover:text-t1 hover:bg-accent-glow transition-all disabled:opacity-50"
    >
      <span>🔔</span>
      <span>{state === 'loading' ? 'Setting up…' : 'Notify Me when someone joins'}</span>
    </button>
  )
}
