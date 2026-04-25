import { Router } from 'express'
import client from './redisClient.js'

const router = Router()

// ── GET /api/ice-servers ──────────────────────────────────────
// Returns ICE server config to the client.
// Credentials stay server-side — never in the client bundle.
//
// Priority:
//   1. Metered.ca managed TURN (if METERED_API_KEY is set)
//   2. Self-hosted TURN (if TURN_URL is set in .env)
//   3. Open-relay public TURN (free, ~1GB/day, good for dev/small scale)
//   4. STUN only (fallback — 80% of users, silent failure for rest)
router.get('/ice-servers', async (req, res) => {
    // Always include Google STUN
    const servers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]

    try {
        // Option 1: Metered.ca API (best — dynamic short-lived credentials)
        if (process.env.METERED_API_KEY && process.env.METERED_APP_NAME) {
            const url = `https://${process.env.METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`
            const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
            if (response.ok) {
                const turnServers = await response.json()
                return res.json([...servers, ...turnServers])
            }
        }

        // Option 2: Self-hosted Coturn (env vars)
        if (process.env.TURN_URL) {
            servers.push({
                urls:       process.env.TURN_URL,
                username:   process.env.TURN_USERNAME || '',
                credential: process.env.TURN_CREDENTIAL || '',
            })
            return res.json(servers)
        }

        // Option 3: Open-relay public TURN (free tier, no signup)
        // Good for testing and early users. ~1GB free/day.
        servers.push(
            {
                urls:       'turn:openrelay.metered.ca:80',
                username:   'openrelayproject',
                credential: 'openrelayproject',
            },
            {
                urls:       'turn:openrelay.metered.ca:443',
                username:   'openrelayproject',
                credential: 'openrelayproject',
            },
            {
                urls:       'turn:openrelay.metered.ca:443?transport=tcp',
                username:   'openrelayproject',
                credential: 'openrelayproject',
            },
        )
        return res.json(servers)
    } catch (err) {
        console.error('[ICE] Failed to fetch TURN credentials:', err.message)
        // Return STUN-only as safe fallback
        return res.json(servers)
    }
})

// ── POST /api/notify/subscribe ────────────────────────────────
// Saves a Web Push subscription tied to a college domain.
// Called from the client when user clicks "Notify Me".
router.post('/notify/subscribe', async (req, res) => {
    try {
        const { subscription, collegeDomain } = req.body
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription' })
        }

        const domain = collegeDomain || 'global'
        const key    = `notify:${domain}`

        // Store as JSON string in a Redis Set (deduplicates by endpoint)
        await client.sAdd(key, JSON.stringify(subscription))
        await client.expire(key, 30 * 24 * 60 * 60) // 30-day TTL — resubscribe monthly

        console.log(`[Notify] Subscription saved for domain: ${domain}`)
        res.json({ success: true })
    } catch (err) {
        console.error('[Notify] subscribe error:', err)
        res.status(500).json({ error: err.message })
    }
})

// ── POST /api/notify/unsubscribe ──────────────────────────────
router.post('/notify/unsubscribe', async (req, res) => {
    try {
        const { subscription, collegeDomain } = req.body
        if (!subscription) return res.status(400).json({ error: 'Missing subscription' })

        const domain = collegeDomain || 'global'
        await client.sRem(`notify:${domain}`, JSON.stringify(subscription))
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

export default router
