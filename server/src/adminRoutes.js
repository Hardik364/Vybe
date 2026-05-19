import { Router } from 'express'
import client from './redisClient.js'
import { getSnapshot } from './userRegistry.js'

const router = Router()

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

// ── GET /admin/dashboard ──────────────────────────────────────
// Full live snapshot — polled every 3s by the dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
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
router.post('/kick', requireAdmin, (req, res) => {
    const { socketId, io } = req.body
    // io is passed via app.locals
    const socket = req.app.locals.io?.sockets?.sockets?.get(socketId)
    if (!socket) return res.status(404).json({ error: 'Socket not found' })
    socket.emit('kicked', 'You were removed by an admin.')
    socket.disconnect(true)
    res.json({ success: true, kicked: socketId })
})

// ── POST /admin/ban ───────────────────────────────────────────
// Ban an email address
router.post('/ban', requireAdmin, async (req, res) => {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })
    await client.sAdd('banned:emails', email.toLowerCase())
    res.json({ success: true, banned: email })
})

// ── POST /admin/unban ─────────────────────────────────────────
router.post('/unban', requireAdmin, async (req, res) => {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })
    await client.sRem('banned:emails', email.toLowerCase())
    res.json({ success: true, unbanned: email })
})

// ── POST /admin/unshadow ──────────────────────────────────────
// Remove shadow ban from a socket
router.post('/unshadow', requireAdmin, async (req, res) => {
    const { socketId } = req.body
    if (!socketId) return res.status(400).json({ error: 'socketId required' })
    await client.sRem('shadowBanned', socketId)
    res.json({ success: true })
})

// ── GET /admin/karma/:socketId ────────────────────────────────
router.get('/karma/:socketId', requireAdmin, async (req, res) => {
    const karma = await client.hGetAll(`karma:${req.params.socketId}`)
    res.json(karma)
})

// ── GET /admin/reports/:socketId ──────────────────────────────
router.get('/reports/:socketId', requireAdmin, async (req, res) => {
    const reports = await client.zRangeWithScores(`reports:${req.params.socketId}`, 0, -1)
    res.json({ count: reports.length, reporters: reports })
})

export default router
