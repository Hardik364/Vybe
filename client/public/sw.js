// RealTalk Service Worker — handles Web Push notifications (Notify Me feature)
// Registered by App.jsx on mount.  Must live at /sw.js (served from public/).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// ── Push received ────────────────────────────────────────────
self.addEventListener('push', event => {
    let data = {}
    try { data = event.data?.json() ?? {} } catch { data = { title: 'RealTalk', body: event.data?.text() || '' } }

    const title   = data.title || 'RealTalk'
    const options = {
        body:    data.body    || 'Someone from your college is online — jump in!',
        icon:    data.icon    || '/favicon.ico',
        badge:   data.badge   || '/favicon.ico',
        tag:     data.tag     || 'realtalk-notify',
        data:    { url: data.url || '/' },
        renotify: true,
        requireInteraction: false,
    }

    event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click — open / focus the app tab ────────────
self.addEventListener('notificationclick', event => {
    event.notification.close()
    const targetUrl = event.notification.data?.url || '/'
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if (c.url.includes(targetUrl) && 'focus' in c) return c.focus()
            }
            return clients.openWindow(targetUrl)
        })
    )
})
