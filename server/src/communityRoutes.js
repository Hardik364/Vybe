import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import jwt from 'jsonwebtoken'
import client from './redisClient.js'

const router = Router()

// Default channels seeded on first run
const DEFAULT_CHANNELS = [
    { id: 'general',       name: 'general',       description: 'Talk about anything', emoji: '💬', isDefault: true },
    { id: 'introductions', name: 'introductions',  description: 'Introduce yourself',  emoji: '👋', isDefault: true },
    { id: 'study-help',    name: 'study-help',     description: 'Ask academic questions', emoji: '📚', isDefault: true },
    { id: 'memes',         name: 'memes',          description: 'Memes & fun stuff',   emoji: '😂', isDefault: true },
    { id: 'placements',    name: 'placements',     description: 'Jobs, internships, prep', emoji: '💼', isDefault: true },
    { id: 'random',        name: 'random',         description: 'Anything goes',       emoji: '🎲', isDefault: true },
]

async function seedDefaultChannels() {
    for (const ch of DEFAULT_CHANNELS) {
        const exists = await client.exists(`channel:${ch.id}`)
        if (!exists) {
            await client.hSet(`channel:${ch.id}`, {
                id:          ch.id,
                name:        ch.name,
                description: ch.description,
                emoji:       ch.emoji,
                isDefault:   '1',
                creator:     'system',
                createdAt:   Date.now().toString(),
            })
            await client.zAdd('channels', { score: 0, value: ch.id }) // score 0 = pinned at top
        }
    }
}

// Seed once Redis is ready — listen for the 'ready' event to avoid
// ClientClosedError when the module loads before client.connect() runs
client.on('ready', () => {
    seedDefaultChannels().catch(err =>
        console.error('[Community] seedDefaultChannels failed:', err.message)
    )
})

// ── GET /community/channels ───────────────────────────────────
// Returns all channels ordered by member activity
router.get('/channels', async (req, res) => {
    try {
        const ids      = await client.zRevRange('channels', 0, -1)
        const channels = await Promise.all(ids.map(async id => {
            const ch           = await client.hGetAll(`channel:${id}`)
            const messageCount = await client.lLen(`channel:messages:${id}`)
            return { ...ch, messageCount, memberCount: parseInt(ch.memberCount || 0) }
        }))
        res.json(channels.filter(c => c.id))
    } catch (err) {
        console.error('[community/channels GET]', err)
        res.status(500).json({ error: 'Failed to load channels.' })
    }
})

// ── POST /community/channels ──────────────────────────────────
// Create a new channel — requires a valid JWT (verified college student)
router.post('/channels', async (req, res) => {
    try {
        // Authenticate: extract username from verified JWT, not from request body
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Login required to create a channel' })
        let jwtUser
        try {
            jwtUser = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token' })
        }

        const { name, description, emoji } = req.body
        const username = jwtUser.username   // always from verified JWT
        if (!name) return res.status(400).json({ error: 'Channel name is required' })

        const clean = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32)
        if (clean.length < 2) return res.status(400).json({ error: 'Name too short' })

        // Check for duplicates
        const exists = await client.exists(`channel:${clean}`)
        if (exists) return res.status(409).json({ error: 'Channel already exists' })

        const id  = clean
        const now = Date.now()

        await client.hSet(`channel:${id}`, {
            id,
            name:        clean,
            description: (description || '').slice(0, 120),
            emoji:       emoji || '💬',
            isDefault:   '0',
            creator:     username,
            createdAt:   now.toString(),
            memberCount: '0',
        })
        await client.zAdd('channels', { score: now, value: id })

        res.json({ success: true, id, name: clean })
    } catch (err) {
        console.error('[community/channels POST]', err)
        res.status(500).json({ error: 'Failed to create channel.' })
    }
})

// ── GET /community/channels/:id/messages ──────────────────────
// Last 60 messages in a channel — email field stripped before sending to client
router.get('/channels/:id/messages', async (req, res) => {
    try {
        // Validate channelId format before using in Redis key
        const channelId = req.params.id
        if (!/^[a-z0-9-]{2,32}$/.test(channelId)) {
            return res.status(400).json({ error: 'Invalid channel ID' })
        }
        const raw  = await client.lRange(`channel:messages:${channelId}`, -60, -1)
        // Strip email from every message before sending — never expose user emails publicly
        const msgs = raw.map(m => {
            const { email, ...safe } = JSON.parse(m)
            return safe
        })
        res.json(msgs)
    } catch (err) {
        console.error('[community/messages]', err)
        res.status(500).json({ error: 'Failed to load messages.' })
    }
})

// ── GET /community/karma/:socketId ───────────────────────────
// Public — only aggregated counts, no PII. Used to show a user their own karma.
router.get('/karma/:socketId', async (req, res) => {
    try {
        const raw = await client.hGetAll(`karma:${req.params.socketId}`)
        if (!raw || !raw.total) return res.json({ total: 0, great: 0, okay: 0, disrespectful: 0 })
        res.json({
            total:         parseInt(raw.total         || 0),
            great:         parseInt(raw.great         || 0),
            okay:          parseInt(raw.okay          || 0),
            disrespectful: parseInt(raw.disrespectful || 0),
        })
    } catch (err) {
        console.error('[community/karma]', err)
        res.status(500).json({ error: 'Failed to load karma.' })
    }
})

export default router
