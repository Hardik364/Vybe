import { processUserPairing, soloUserLeftTheChat, emitLiveCount } from "./userConstroller/userController.js"
// soloUserLeftTheChat is also called on disconnect to purge ghost queue entries
import { registerUser, updateStatus, removeUser } from "./userRegistry.js"
import { werePartnered, cleanupPartnership } from "./partnerships.js"
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import client from "./redisClient.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const prompts    = JSON.parse(readFileSync(join(__dirname, 'data/prompts.json'), 'utf8'))

function pickPrompt(excludeId = null) {
    const pool = excludeId ? prompts.filter(p => p.id !== excludeId) : prompts
    return pool[Math.floor(Math.random() * pool.length)]
}

// ── Track pending Connect requests: socketId → { partnerId, timer }
const pendingConnects = new Map()

// (video consent tracking removed — each user controls their own camera independently)

// ── Per-socket rate limiter ───────────────────────────────────────────────────
// limits: Map of event name → { windowMs, max }
const RATE_LIMITS = {
    'channel:message': { windowMs: 3000,  max: 5  },  // 5 msgs per 3 sec
    'reportUser':      { windowMs: 60000, max: 3  },  // 3 reports per min
    'rateUser':        { windowMs: 60000, max: 10 },  // 10 ratings per min
    'private message': { windowMs: 1000,  max: 10 },  // 10 msgs per sec
}

// socketId → Map<eventName, { count, resetAt }>
const rateLimitState = new Map()

function isRateLimited(socketId, event) {
    const limit = RATE_LIMITS[event]
    if (!limit) return false

    if (!rateLimitState.has(socketId)) rateLimitState.set(socketId, new Map())
    const socketLimits = rateLimitState.get(socketId)

    const now = Date.now()
    if (!socketLimits.has(event) || now > socketLimits.get(event).resetAt) {
        socketLimits.set(event, { count: 1, resetAt: now + limit.windowMs })
        return false
    }

    const state = socketLimits.get(event)
    if (state.count >= limit.max) return true
    state.count++
    return false
}

function cleanupRateLimit(socketId) {
    rateLimitState.delete(socketId)
}

export function handelSocketConnection(io, socket) {

    // Register user in live registry
    registerUser(socket)

    // ── Pairing ──────────────────────────────────────────────
    socket.on("startConnection", () => {
        updateStatus(socket.id, 'waiting')
        processUserPairing(io, socket)
    })

    socket.on("pairedUserLeftTheChat", to => {
        io.to(to).emit("strangerLeftTheChat")
        updateStatus(socket.id, 'waiting')
        updateStatus(to, 'waiting')
        emitLiveCount(io, socket)
    })

    socket.on("soloUserLeftTheChat", () => {
        const room = `waiting:${socket.collegeDomain || 'global'}`
        soloUserLeftTheChat(socket)
        socket.leave(room)
        updateStatus(socket.id, 'connecting')
        emitLiveCount(io, socket)
    })

    // ── WebRTC signaling ─────────────────────────────────────
    socket.on('message', m => io.to(m.to).emit('message', m))

    // ── Text chat ────────────────────────────────────────────
    socket.on("private message", ({ content, to }) => {
        if (isRateLimited(socket.id, 'private message')) return
        io.to(to).emit("private message", { content, from: socket.id })
    })

    // ── Prompt sync ──────────────────────────────────────────
    socket.on('requestPrompt', ({ to }) => {
        const prompt = pickPrompt()
        io.to(socket.id).emit('showPrompt', prompt)
        io.to(to).emit('showPrompt', prompt)
    })

    socket.on('nextPrompt', ({ to, excludeId }) => {
        const prompt = pickPrompt(excludeId)
        io.to(socket.id).emit('showPrompt', prompt)
        io.to(to).emit('showPrompt', prompt)
    })

    socket.on('dismissPrompt', ({ to }) => {
        io.to(socket.id).emit('hidePrompt')
        io.to(to).emit('hidePrompt')
    })

    // ── Video — each user controls their own camera ───────────
    // Pressing Enable Video turns YOUR camera on immediately.
    // Partner gets notified so they can optionally do the same.
    socket.on('videoOn',  ({ to }) => io.to(to).emit('partnerVideoOn'))
    socket.on('videoOff', ({ to }) => io.to(to).emit('partnerVideoOff'))

    // ── Connect / Move On ─────────────────────────────────────
    socket.on('connectRequest', ({ to }) => {
        if (pendingConnects.has(to) && pendingConnects.get(to).partnerId === socket.id) {
            clearTimeout(pendingConnects.get(to).timer)
            pendingConnects.delete(to)
            pendingConnects.delete(socket.id)
            io.to(socket.id).emit('contactsExchanged')
            io.to(to).emit('contactsExchanged')
        } else {
            const timer = setTimeout(() => {
                pendingConnects.delete(socket.id)
                io.to(socket.id).emit('connectExpired')
            }, 31000)
            pendingConnects.set(socket.id, { partnerId: to, timer })
            io.to(socket.id).emit('connectPending')
        }
    })

    // ── Contact share (after Connect 🤝 mutual press) ─────────
    // Each user submits their contact; server relays to the other only when both have submitted
    const contactSubmissions = new Map() // roomKey → { [socketId]: contactInfo }
    socket.on('submitContact', ({ to, contact }) => {
        if (!to || !contact?.trim()) return
        // Verify they were actually paired
        if (!werePartnered(socket.id, to)) return

        const roomKey = [socket.id, to].sort().join(':')
        if (!contactSubmissions.has(roomKey)) contactSubmissions.set(roomKey, {})
        const room = contactSubmissions.get(roomKey)
        room[socket.id] = contact.trim().slice(0, 100)

        if (room[socket.id] && room[to]) {
            // Both submitted — exchange and clean up
            io.to(socket.id).emit('contactRevealed', { contact: room[to] })
            io.to(to).emit('contactRevealed', { contact: room[socket.id] })
            contactSubmissions.delete(roomKey)
        } else {
            // Tell sender we're waiting for the other person
            socket.emit('contactSubmitted')
        }
    })

    socket.on('cancelConnect', () => {
        if (pendingConnects.has(socket.id)) {
            clearTimeout(pendingConnects.get(socket.id).timer)
            pendingConnects.delete(socket.id)
        }
    })

    socket.on('moveOn', ({ to }) => {
        if (pendingConnects.has(socket.id)) {
            clearTimeout(pendingConnects.get(socket.id).timer)
            pendingConnects.delete(socket.id)
        }
        io.to(to).emit('partnerMovedOn')
    })

    // ── Karma Rating ──────────────────────────────────────────
    socket.on('rateUser', async ({ to, rating }) => {
        if (!rating || !to) return

        // Rate limit: max 10 ratings per minute per socket
        if (isRateLimited(socket.id, 'rateUser')) {
            console.warn(`[rateUser] Rate limited: ${socket.id}`)
            return
        }

        // Must have been in a call with this person
        if (!werePartnered(socket.id, to)) {
            console.warn(`[rateUser] ${socket.id} tried to rate ${to} without being paired`)
            return
        }

        try {
            await client.hIncrBy(`karma:${to}`, rating, 1)
            await client.hIncrBy(`karma:${to}`, 'total', 1)

            const karma = await client.hGetAll(`karma:${to}`)
            const total = parseInt(karma.total || 0)
            const bad   = parseInt(karma.disrespectful || 0)
            if (total >= 5 && bad / total > 0.2) {
                await client.sAdd('shadowBanned', to)
                console.log(`[Karma] Shadow-banned ${to} (${bad}/${total} disrespectful)`)
            }
        } catch (err) {
            console.error('[rateUser]', err)
        }
    })

    // ── Report (mid-call) ─────────────────────────────────────
    socket.on('reportUser', async ({ to, reason }) => {
        if (!to) return

        // Rate limit: max 3 reports per minute per socket
        if (isRateLimited(socket.id, 'reportUser')) {
            console.warn(`[reportUser] Rate limited: ${socket.id}`)
            return
        }

        // Must have been in a call with this person
        if (!werePartnered(socket.id, to)) {
            console.warn(`[reportUser] ${socket.id} tried to report ${to} without being paired`)
            return
        }

        try {
            await client.zAdd(`reports:${to}`, {
                score: Date.now(),
                value: socket.id,
            }, { NX: true })

            const reportCount = await client.zCard(`reports:${to}`)
            console.log(`[Report] ${to} has ${reportCount} unique report(s). Reason: ${reason || 'none'}`)

            if (reportCount >= 3) {
                const reportedSocket = io.sockets.sockets.get(to)
                if (reportedSocket) {
                    if (reportedSocket.email) {
                        await client.sAdd('banned:emails', reportedSocket.email)
                        console.log(`[Report] Banned email: ${reportedSocket.email}`)
                    }
                    await client.sAdd('suspended', to)
                    reportedSocket.emit('accountSuspended',
                        'Your account has been suspended due to multiple reports.')
                    reportedSocket.disconnect(true)
                    console.log(`[Report] Auto-suspended socket ${to}`)
                }
            }
        } catch (err) {
            console.error('[reportUser]', err)
        }
    })

    // ── Community Channels ────────────────────────────────────
    socket.on('channel:join', async ({ channelId }) => {
        if (!channelId) return
        try {
            socket.join(`ch:${channelId}`)
            await client.hIncrBy(`channel:${channelId}`, 'memberCount', 1)
            const count = io.sockets.adapter.rooms.get(`ch:${channelId}`)?.size || 0
            io.to(`ch:${channelId}`).emit('channel:memberCount', { channelId, count })
        } catch (err) {
            console.error('[channel:join]', err)
        }
    })

    socket.on('channel:leave', async ({ channelId }) => {
        if (!channelId) return
        try {
            socket.leave(`ch:${channelId}`)
            await client.hIncrBy(`channel:${channelId}`, 'memberCount', -1)
            const count = io.sockets.adapter.rooms.get(`ch:${channelId}`)?.size || 0
            io.to(`ch:${channelId}`).emit('channel:memberCount', { channelId, count })
        } catch (err) {
            console.error('[channel:leave]', err)
        }
    })

    // Typing indicator — broadcast to channel, exclude sender
    socket.on('channel:typing', ({ channelId }) => {
        if (!channelId) return
        socket.to(`ch:${channelId}`).emit('channel:typing', {
            channelId,
            username: socket.username || 'someone',
        })
    })

    socket.on('channel:stopTyping', ({ channelId }) => {
        if (!channelId) return
        socket.to(`ch:${channelId}`).emit('channel:stopTyping', {
            channelId,
            username: socket.username || 'someone',
        })
    })

    socket.on('channel:message', async ({ channelId, content }) => {
        if (!channelId || !content?.trim()) return

        // Rate limit: 5 messages per 3 seconds
        if (isRateLimited(socket.id, 'channel:message')) {
            socket.emit('channel:rateLimited', { message: 'Slow down! Too many messages.' })
            return
        }

        try {
            const text = content.trim().slice(0, 500)

            const msg = {
                id:        `${Date.now()}-${socket.id.slice(0, 6)}`,
                channelId,
                content:   text,
                author:    socket.username || 'anonymous',
                email:     socket.email    || null,
                timestamp: Date.now(),
            }

            await client.rPush(`channel:messages:${channelId}`, JSON.stringify(msg))
            await client.lTrim(`channel:messages:${channelId}`, -200, -1)
            await client.zAdd('channels', { score: Date.now(), value: channelId }, { XX: true })

            io.to(`ch:${channelId}`).emit('channel:message', msg)
        } catch (err) {
            console.error('[channel:message]', err)
            socket.emit('channel:error', { message: 'Failed to send message. Please try again.' })
        }
    })

    // ── Report a community message ────────────────────────────
    socket.on('channel:report_message', async ({ channelId, messageId, author }) => {
        if (!channelId || !messageId) return
        try {
            const key = `ch:report:${messageId}`
            await client.zAdd(key, { score: Date.now(), value: socket.id }, { NX: true })
            await client.expire(key, 7 * 24 * 60 * 60) // keep reports for 7 days
            const count = await client.zCard(key)
            console.log(`[ChannelReport] msg=${messageId} ch=${channelId} author=${author} total=${count}`)
            socket.emit('channel:reportAck', { messageId })
        } catch (err) {
            console.error('[channel:report_message]', err)
        }
    })

    // Admin-only: delete a message via REST /admin endpoint instead of socket
    // Kept here for backward compat but moves auth check to server-side only
    socket.on('channel:delete_message', async ({ channelId, messageId }) => {
        const adminKey = socket.handshake.auth.adminKey
        if (!adminKey || adminKey !== process.env.ADMIN_KEY) return

        try {
            const raw  = await client.lRange(`channel:messages:${channelId}`, 0, -1)
            const kept = raw.filter(m => JSON.parse(m).id !== messageId)
            await client.del(`channel:messages:${channelId}`)
            if (kept.length) await client.rPush(`channel:messages:${channelId}`, ...kept)
            io.to(`ch:${channelId}`).emit('channel:messageDeleted', { channelId, messageId })
        } catch (err) {
            console.error('[channel:delete_message]', err)
        }
    })

    // ── Disconnect cleanup ────────────────────────────────────
    socket.on('disconnect', async () => {
        try {
            // ── CRITICAL: remove from Redis waiting queue ─────
            // Without this, a refresh leaves a ghost entry in the queue.
            // The ghost can be picked up and paired with the same user's
            // new socket — making them talk to themselves.
            await soloUserLeftTheChat(socket)

            if (pendingConnects.has(socket.id)) {
                clearTimeout(pendingConnects.get(socket.id).timer)
                pendingConnects.delete(socket.id)
            }

            cleanupPartnership(socket.id)
            cleanupRateLimit(socket.id)
            removeUser(socket.id)
            socket.removeAllListeners()
        } catch (error) {
            console.error('[disconnect cleanup]', error)
        }
    })
}
