import { processUserPairing, soloUserLeftTheChat, emitLiveCount, emitGenderStats } from "./userConstroller/userController.js"
// soloUserLeftTheChat is also called on disconnect to purge ghost queue entries
import { registerUser, updateStatus, updateGenderPref, removeUser } from "./userRegistry.js"
import registry from "./userRegistry.js"   // default export = the Map itself
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
    'channel:message':  { windowMs: 3000,  max: 5  },  // 5 msgs per 3 sec
    'reportUser':       { windowMs: 60000, max: 3  },  // 3 reports per min
    'rateUser':         { windowMs: 60000, max: 10 },  // 10 ratings per min
    'private message':  { windowMs: 1000,  max: 10 },  // 10 msgs per sec
    'chatMessage':      { windowMs: 2000,  max: 8  },  // 8 per-call messages per 2 sec
    'startConnection':  { windowMs: 3000,  max: 3  },  // 3 re-queues per 3 sec (prevents Redis flood)
    'connectRequest':   { windowMs: 10000, max: 5  },  // 5 connect presses per 10 sec
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

// ── Guest call tracking helpers ──────────────────────────────
// Keys: "guest_calls:{deviceId}" and "guest_calls:ip:{ip}"
// TTL: 24 hours — resets daily so guests get 1 call per day
const GUEST_CALL_TTL = 24 * 60 * 60   // 24 hours in seconds
const GUEST_CALL_MAX = 1               // calls allowed per guest per day

async function hasGuestExceededLimit(socket) {
    if (!socket.isGuest) return false
    const checks = []
    if (socket.deviceId) checks.push(`guest_calls:device:${socket.deviceId}`)
    if (socket.guestIp)  checks.push(`guest_calls:ip:${socket.guestIp}`)
    if (!checks.length)  return false

    const counts = await Promise.all(checks.map(k => client.get(k)))
    return counts.some(c => parseInt(c || '0') >= GUEST_CALL_MAX)
}

async function incrementGuestCalls(socket) {
    if (!socket.isGuest) return
    const pipe = client.multi()
    if (socket.deviceId) {
        const k = `guest_calls:device:${socket.deviceId}`
        pipe.incr(k)
        pipe.expire(k, GUEST_CALL_TTL)
    }
    // IP tracking is secondary — don't block on campus wifi (shared IP)
    // Just track it for analytics, not enforcement
    await pipe.exec()
}

export async function handelSocketConnection(io, socket) {

    // ── Load gender from Redis (persisted server-side, not trusted from client) ──
    if (socket.email) {
        socket.gender = await client.get(`user:gender:${socket.email}`) || 'unspecified'
    } else {
        socket.gender = 'unspecified'
    }
    // genderPref was validated and set in the auth middleware (server.js)

    // Register user in live registry (gender + genderPref now on socket)
    registerUser(socket)
    emitGenderStats(io)

    // Join a persistent college room — stays joined for the entire session
    // (waiting AND in-call). Used for accurate live count.
    const collegeRoom = `college:${socket.collegeDomain || 'global'}`
    socket.join(collegeRoom)

    // ── Pairing ──────────────────────────────────────────────
    socket.on("startConnection", async () => {
        // Rate limit: prevent Redis flood from rapid re-queue clicks
        if (isRateLimited(socket.id, 'startConnection')) return

        // Block guests who have already used their free call today
        if (socket.isGuest) {
            const exceeded = await hasGuestExceededLimit(socket)
            if (exceeded) {
                socket.emit('guestLimitReached')
                return
            }
        }
        updateStatus(socket.id, 'waiting')
        processUserPairing(io, socket)
    })

    socket.on("pairedUserLeftTheChat", to => {
        // Validate the two sockets were actually partnered — prevents
        // any socket from sending strangerLeftTheChat to a random target.
        if (!werePartnered(socket.id, to)) return
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

    // ── Gender preference — can be changed from navbar anytime ──
    // Only takes effect for the NEXT queue entry (current wait slot is already pushed).
    socket.on('updateGenderPref', pref => {
        const VALID = new Set(['anyone', 'male', 'female', 'transgender'])
        if (!VALID.has(pref)) return
        socket.genderPref = pref
        updateGenderPref(socket.id, pref)
    })

    // ── WebRTC signaling ─────────────────────────────────────
    socket.on('message', m => io.to(m.to).emit('message', m))

    // ── Text chat ─────────────────────────────────────────────
    socket.on('chatMessage', m => {
        if (!m?.to || !m?.message) return
        if (isRateLimited(socket.id, 'chatMessage')) return
        if (!werePartnered(socket.id, m.to)) return   // prevent messaging arbitrary sockets
        // Sanitize: strip HTML tags, enforce length cap
        const safe = String(m.message).replace(/<[^>]*>/g, '').trim().slice(0, 1000)
        if (!safe) return
        io.to(m.to).emit('messageResponse', { message: safe })
    })

    // ── Prompt sync ──────────────────────────────────────────
    socket.on('requestPrompt', ({ to }) => {
        if (!werePartnered(socket.id, to)) return
        const prompt = pickPrompt()
        io.to(socket.id).emit('showPrompt', prompt)
        io.to(to).emit('showPrompt', prompt)
    })

    socket.on('nextPrompt', ({ to, excludeId }) => {
        if (!werePartnered(socket.id, to)) return
        const prompt = pickPrompt(excludeId)
        io.to(socket.id).emit('showPrompt', prompt)
        io.to(to).emit('showPrompt', prompt)
    })

    socket.on('dismissPrompt', ({ to }) => {
        if (!werePartnered(socket.id, to)) return
        io.to(socket.id).emit('hidePrompt')
        io.to(to).emit('hidePrompt')
    })

    // ── Video — each user controls their own camera ───────────
    // Pressing Enable Video turns YOUR camera on immediately.
    // Partner gets notified so they can optionally do the same.
    socket.on('videoOn',  ({ to }) => { if (werePartnered(socket.id, to)) io.to(to).emit('partnerVideoOn') })
    socket.on('videoOff', ({ to }) => { if (werePartnered(socket.id, to)) io.to(to).emit('partnerVideoOff') })

    // ── Connect / Move On ─────────────────────────────────────
    socket.on('connectRequest', ({ to, contact }) => {
        if (isRateLimited(socket.id, 'connectRequest')) return
        if (!werePartnered(socket.id, to)) return   // prevent fake partnerConnect spam
        // Notify partner immediately that this user pressed Connect
        io.to(to).emit('partnerConnect')

        if (pendingConnects.has(to) && pendingConnects.get(to).partnerId === socket.id) {
            // Mutual connect — exchange contacts
            const theirEntry = pendingConnects.get(to)
            clearTimeout(theirEntry.timer)
            pendingConnects.delete(to)
            pendingConnects.delete(socket.id)

            // Build { whatsapp, instagram } objects for each side
            const toData = contact => contact?.value
                ? { [contact.type]: contact.value }
                : {}
            io.to(socket.id).emit('contactsExchanged', toData(theirEntry.contact))
            io.to(to).emit('contactsExchanged', toData(contact))
        } else {
            const timer = setTimeout(() => {
                pendingConnects.delete(socket.id)
                io.to(socket.id).emit('connectExpired')
            }, 31000)
            pendingConnects.set(socket.id, { partnerId: to, timer, contact: contact || null })
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
        // Allow moveOn even if partnership record has been cleaned up —
        // the worst case is a spurious partnerMovedOn to a re-queued socket,
        // which is handled client-side by the safeMoveOn guard (movedOnRef).
        // Being too strict here causes PostCallScreen to silently get stuck.
        if (!to) return
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
            // Key karma by the target socket's email (persistent across reconnects),
            // falling back to socket ID only for unauthenticated guests.
            const targetSocket = io.sockets.sockets.get(to)
            const karmaKey = targetSocket?.email
                ? `karma:email:${targetSocket.email}`
                : `karma:socket:${to}`

            await client.hIncrBy(karmaKey, rating, 1)
            await client.hIncrBy(karmaKey, 'total', 1)

            const karma = await client.hGetAll(karmaKey)
            const total = parseInt(karma.total || 0)
            const bad   = parseInt(karma.disrespectful || 0)
            if (total >= 5 && bad / total > 0.2) {
                // Shadow-ban persistently by email — survives reconnects
                if (targetSocket?.email) {
                    await client.sAdd('shadowBanned:emails', targetSocket.email)
                    console.log(`[Karma] Shadow-banned ${targetSocket.email} (${bad}/${total} disrespectful)`)
                } else {
                    await client.sAdd('shadowBanned', to)
                    console.log(`[Karma] Shadow-banned socket ${to} (${bad}/${total} disrespectful)`)
                }
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
            // Deduplicate reporters by email (not socket ID) so cycling
            // connections can't generate multiple reports from one person.
            const reporterKey = socket.email || socket.id
            await client.zAdd(`reports:${to}`, {
                score: Date.now(),
                value: reporterKey,
            }, { NX: true })

            const reportCount = await client.zCard(`reports:${to}`)
            console.log(`[Report] ${to} has ${reportCount} unique report(s). Reason: ${reason || 'none'}`)

            if (reportCount >= 3) {
                const reportedSocket = io.sockets.sockets.get(to)
                if (reportedSocket) {
                    // Notify the reported user's current partner BEFORE disconnecting
                    // so they don't get stuck with a frozen call.
                    const reportedRecord    = registry.get(to)
                    const reportedPartnerId = reportedRecord?.pairedWith
                    if (reportedPartnerId) {
                        io.to(reportedPartnerId).emit('strangerLeftTheChat')
                        updateStatus(reportedPartnerId, 'waiting')
                    }

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
        // Validate format: alphanumeric + hyphens only, 2–32 chars
        if (!/^[a-z0-9-]{2,32}$/.test(channelId)) return
        try {
            // Only join if the channel actually exists — prevents Redis keyspace pollution
            const exists = await client.exists(`channel:${channelId}`)
            if (!exists) return
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
            // Strip HTML tags (XSS prevention) + enforce length cap
            const text = content.trim().replace(/<[^>]*>/g, '').slice(0, 500)
            if (!text) return

            const msg = {
                id:        `${Date.now()}-${socket.id.slice(0, 6)}`,
                channelId,
                content:   text,
                author:    (socket.username || 'anonymous').replace(/<[^>]*>/g, '').slice(0, 32),
                // email intentionally omitted — never expose email addresses in public channel messages
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

            // Look up partner BEFORE removeUser wipes the record.
            // If this socket was in a call, notify the partner so they
            // don't get stuck with a frozen peer connection forever.
            const record    = registry.get(socket.id)
            const partnerId = record?.pairedWith

            await soloUserLeftTheChat(socket)

            if (partnerId) {
                io.to(partnerId).emit('strangerLeftTheChat')
                updateStatus(partnerId, 'waiting')
            }

            if (pendingConnects.has(socket.id)) {
                clearTimeout(pendingConnects.get(socket.id).timer)
                pendingConnects.delete(socket.id)
            }

            // Grace period before wiping partnership record so the partner
            // can still submit a rating/report during the post-call window.
            // 65 s = PostCallScreen 30 s + KarmaModal up to ~30 s + 5 s buffer.
            // Ensures moveOn / rateUser / reportUser events from PostCallScreen
            // and KarmaModal are never silently dropped by werePartnered().
            setTimeout(() => cleanupPartnership(socket.id), 65_000)
            cleanupRateLimit(socket.id)
            removeUser(socket.id)
            emitGenderStats(io)
            socket.removeAllListeners()
        } catch (error) {
            console.error('[disconnect cleanup]', error)
        }
    })
}
