import { Router } from 'express'
import { v4 as uuid } from 'uuid'
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
        res.status(500).json({ error: err.message })
    }
})

// ── POST /community/channels ──────────────────────────────────
// Create a new channel
router.post('/channels', async (req, res) => {
    try {
        const { name, description, emoji, username } = req.body
        if (!name || !username) return res.status(400).json({ error: 'Name and username required' })

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
        res.status(500).json({ error: err.message })
    }
})

// ── GET /community/channels/:id/messages ──────────────────────
// Last 60 messages in a channel
router.get('/channels/:id/messages', async (req, res) => {
    try {
        const raw  = await client.lRange(`channel:messages:${req.params.id}`, -60, -1)
        const msgs = raw.map(m => JSON.parse(m))
        res.json(msgs)
    } catch (err) {
        res.status(500).json({ error: err.message })
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
        res.status(500).json({ error: err.message })
    }
})

export default router
