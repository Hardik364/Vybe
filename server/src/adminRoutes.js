import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import client from './redisClient.js'
import { getSnapshot } from './userRegistry.js'

const router = Router()

// ── Email validation ──────────────────────────────────────────
// RFC-5321 simplified: local@domain.tld, max 254 chars, no consecutive dots
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
function isValidEmail(email) {
    return typeof email === 'string' &&
        email.length <= 254 &&
        EMAIL_RE.test(email) &&
        !email.includes('..')
}

// ── Admin auth middleware ─────────────────────────────────────
// Key MUST be sent via header — never via query string (would appear in server logs,
// browser history, and Referer headers sent to third-party resources).
function requireAdmin(req, res, next) {
    const key = req.headers['x-admin-key']
    if (!key || key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Forbidden' })
    }
    next()
}

// ── Admin rate limiter ───────────────────────────────────────
// Separate tight limit so brute-forcing the admin key is infeasible
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 60 : 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.headers['x-admin-key'] || req.ip,
    message: { error: 'Too many admin requests, slow down.' }
})

// ── Brute-force guard on failed auth attempts ─────────────────
// Key attempts are rate-limited even before auth passes
const keyGuessingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    // Skip counting successful requests (403 means failed auth)
    skip: (req, res) => res.statusCode < 400,
    message: { error: 'Too many failed auth attempts. Try again later.' }
})

router.use(keyGuessingLimiter)
router.use(requireAdmin)
router.use(adminLimiter)

// ── GET /admin/dashboard ──────────────────────────────────────
// Full live snapshot — polled every 5s by the dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const { users, stats } = getSnapshot()

        // Enrich with Redis data
        const shadowBanned  = await client.sCard('shadowBanned')
        const suspended     = await client.sCard('suspended')
        const bannedEmails  = await client.sCard('banned:emails')
        const bannedList    = await client.sMembers('banned:emails')

        res.json({
            stats: {
                ...stats,
                shadowBanned,
                suspended,
                bannedEmails,
            },
            users,
            banned:  bannedList.slice(0, 50),   // last 50 banned emails
            server: {
                uptime: `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`,
                memory: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
                pid:    process.pid,
            },
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        console.error('[admin/dashboard]', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// ── POST /admin/kick ──────────────────────────────────────────
// Disconnect a socket by ID
router.post('/kick', (req, res) => {
    // Destructure only what we need — io comes from app.locals, NOT the body
    const { socketId } = req.body
    if (!socketId || typeof socketId !== 'string' || socketId.length > 40) {
        return res.status(400).json({ error: 'Valid socketId required' })
    }
    const socket = req.app.locals.io?.sockets?.sockets?.get(socketId)
    if (!socket) return res.status(404).json({ error: 'Socket not found' })
    socket.emit('kicked', 'You were removed by an admin.')
    socket.disconnect(true)
    console.log(`[admin/kick] socketId=${socketId}`)
    res.json({ success: true, kicked: socketId })
})

// ── POST /admin/ban ───────────────────────────────────────────
// Ban an email address — kicks any connected socket with that email
router.post('/ban', async (req, res) => {
    const { email } = req.body
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Valid email required' })
    }
    const normalized = email.toLowerCase().trim()
    await client.sAdd('banned:emails', normalized)

    // Also kick any currently-connected socket with that email
    const io = req.app.locals.io
    if (io) {
        for (const [, socket] of io.sockets.sockets) {
            if (socket.email?.toLowerCase() === normalized) {
                socket.emit('kicked', 'Your account has been banned.')
                socket.disconnect(true)
            }
        }
    }

    console.log(`[admin/ban] email=${normalized}`)
    res.json({ success: true, banned: normalized })
})

// ── POST /admin/unban ─────────────────────────────────────────
router.post('/unban', async (req, res) => {
    const { email } = req.body
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Valid email required' })
    }
    const normalized = email.toLowerCase().trim()
    await client.sRem('banned:emails', normalized)
    console.log(`[admin/unban] email=${normalized}`)
    res.json({ success: true, unbanned: normalized })
})

// ── POST /admin/unshadow ──────────────────────────────────────
// Remove shadow ban from a socket
router.post('/unshadow', async (req, res) => {
    const { socketId } = req.body
    if (!socketId || typeof socketId !== 'string' || socketId.length > 40) {
        return res.status(400).json({ error: 'Valid socketId required' })
    }
    await client.sRem('shadowBanned', socketId)
    // Also remove persistent email shadow ban if we can look up the socket
    const io = req.app.locals.io
    if (io) {
        const socket = io.sockets.sockets.get(socketId)
        if (socket?.email) {
            await client.sRem('shadowBanned:emails', socket.email.toLowerCase())
        }
    }
    console.log(`[admin/unshadow] socketId=${socketId}`)
    res.json({ success: true })
})

// ── GET /admin/karma/:socketId ────────────────────────────────
router.get('/karma/:socketId', async (req, res) => {
    const { socketId } = req.params
    if (!socketId || typeof socketId !== 'string' || socketId.length > 40) {
        return res.status(400).json({ error: 'Invalid socketId' })
    }
    const karma = await client.hGetAll(`karma:${socketId}`)
    res.json(karma)
})

// ── GET /admin/reports/:socketId ──────────────────────────────
router.get('/reports/:socketId', async (req, res) => {
    const { socketId } = req.params
    if (!socketId || typeof socketId !== 'string' || socketId.length > 40) {
        return res.status(400).json({ error: 'Invalid socketId' })
    }
    const reports = await client.zRangeWithScores(`reports:${socketId}`, 0, -1)
    res.json({ count: reports.length, reporters: reports })
})

// ── DELETE /admin/message ─────────────────────────────────────
// Remove a specific message from a channel's Redis list.
// Replaces the old socket-level channel:delete_message event.
// Body: { channelId: string, messageId: string }
router.delete('/message', async (req, res) => {
    const { channelId, messageId } = req.body
    if (!channelId || typeof channelId !== 'string' || channelId.length > 80) {
        return res.status(400).json({ error: 'Valid channelId required' })
    }
    if (!messageId || typeof messageId !== 'string' || messageId.length > 80) {
        return res.status(400).json({ error: 'Valid messageId required' })
    }

    // Sanitise: only allow alphanumeric + dash/underscore/dot in IDs
    if (!/^[\w.\-:@]+$/.test(channelId) || !/^[\w.\-:@]+$/.test(messageId)) {
        return res.status(400).json({ error: 'Invalid ID characters' })
    }

    try {
        const key  = `channel:messages:${channelId}`
        const raw  = await client.lRange(key, 0, -1)
        const kept = raw.filter(m => {
            try { return JSON.parse(m).id !== messageId } catch { return true }
        })
        if (kept.length === raw.length) {
            return res.status(404).json({ error: 'Message not found' })
        }
        await client.del(key)
        if (kept.length) await client.rPush(key, ...kept)

        // Notify all members of the channel
        const io = req.app.locals.io
        io?.to(`ch:${channelId}`).emit('channel:messageDeleted', { channelId, messageId })

        console.log(`[admin/message] deleted messageId=${messageId} from channel=${channelId}`)
        res.json({ success: true, deleted: messageId })
    } catch (err) {
        console.error('[admin/message]', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

export default router
