// pushNotify.js — Web Push helper
// Called by userController when a college queue goes 0 → 1.
// Iterates the Redis Set `notify:{domain}` and fires a push to every subscriber.

import webPush from 'web-push'
import client  from './redisClient.js'

// Configure VAPID once on module load
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@realtalk.in',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
    )
} else {
    console.warn('[Push] VAPID keys not set — Notify Me disabled')
}

// Send push to all subscribers for a college domain.
// Silently cleans up expired/invalid subscriptions from Redis.
export async function sendCollegeNotifications(domain) {
    if (!process.env.VAPID_PUBLIC_KEY) return  // no-op if not configured

    const key   = `notify:${domain}`
    const subs  = await client.sMembers(key)
    if (!subs.length) return

    const payload = JSON.stringify({
        title: 'RealTalk',
        body:  'Someone from your college just joined — be the first to match! 🎉',
        url:   '/',
        tag:   `realtalk-notify-${domain}`,
    })

    let removed = 0
    await Promise.allSettled(
        subs.map(async raw => {
            let sub
            try { sub = JSON.parse(raw) } catch { return }
            try {
                await webPush.sendNotification(sub, payload)
            } catch (err) {
                // 404 / 410 = subscription expired or unsubscribed — remove it
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await client.sRem(key, raw)
                    removed++
                } else {
                    console.error(`[Push] Failed to send to ${sub.endpoint?.slice(-20)}:`, err.message)
                }
            }
        })
    )

    console.log(`[Push] Notified ${subs.length - removed}/${subs.length} subscribers for ${domain}`)
}
