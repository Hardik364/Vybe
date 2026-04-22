import { processUserPairing, soloUserLeftTheChat, emitLiveCount } from "./userConstroller/userController.js"
import { registerUser, updateStatus, removeUser } from "./userRegistry.js"
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

// Track pending Connect requests: socketId → { partnerId, timer }
const pendingConnects = new Map()

// Track video consent: socketId → Set of consenting socket IDs
const videoConsents   = new Map()

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

    // ── Video Consent ─────────────────────────────────────────
    socket.on('videoConsentOn', ({ to }) => {
        if (!videoConsents.has(to)) videoConsents.set(to, new Set())
        videoConsents.get(to).add(socket.id)
        io.to(to).emit('partnerWantsVideo')
        const partnerConsents = videoConsents.get(socket.id)
        if (partnerConsents && partnerConsents.has(to)) {
            io.to(socket.id).emit('videoBothConsented')
            io.to(to).emit('videoBothConsented')
            videoConsents.delete(socket.id)
            videoConsents.delete(to)
        }
    })

    socket.on('videoConsentOff', ({ to }) => {
        if (videoConsents.has(to)) videoConsents.get(to).delete(socket.id)
        io.to(to).emit('partnerTurnedOffVideo')
        io.to(socket.id).emit('videoDisabled')
    })

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
    // Separate from karma — can report DURING a call, not just after
    socket.on('reportUser', async ({ to, reason }) => {
        if (!to) return
        try {
            // Sorted set: reports:{socketId} → member=reporterSocketId, score=timestamp
            // zAdd only adds once per reporter (members are unique)
            await client.zAdd(`reports:${to}`, {
                score:  Date.now(),
                value:  socket.id,
            }, { NX: true })   // NX = only add if not already there (one report per user)

            const reportCount = await client.zCard(`reports:${to}`)
            console.log(`[Report] ${to} has ${reportCount} unique report(s). Reason: ${reason || 'none'}`)

            // 3 unique reporters → auto-suspend
            if (reportCount >= 3) {
                const reportedSocket = io.sockets.sockets.get(to)
                if (reportedSocket) {
                    // Suspend by email if available
                    if (reportedSocket.email) {
                        await client.sAdd('banned:emails', reportedSocket.email)
                        console.log(`[Report] Banned email: ${reportedSocket.email}`)
                    }
                    // Add to suspended socket set (ephemeral — cleared on restart)
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
        socket.join(`ch:${channelId}`)
        // Increment member count
        await client.hIncrBy(`channel:${channelId}`, 'memberCount', 1)
        // Tell everyone in channel how many are online
        const count = io.sockets.adapter.rooms.get(`ch:${channelId}`)?.size || 0
        io.to(`ch:${channelId}`).emit('channel:memberCount', { channelId, count })
    })

    socket.on('channel:leave', async ({ channelId }) => {
        if (!channelId) return
        socket.leave(`ch:${channelId}`)
        await client.hIncrBy(`channel:${channelId}`, 'memberCount', -1)
        const count = io.sockets.adapter.rooms.get(`ch:${channelId}`)?.size || 0
        io.to(`ch:${channelId}`).emit('channel:memberCount', { channelId, count })
    })

    socket.on('channel:message', async ({ channelId, content }) => {
        if (!channelId || !content?.trim()) return

        // Basic content moderation: max 500 chars
        const text = content.trim().slice(0, 500)

        const msg = {
            id:        `${Date.now()}-${socket.id.slice(0,6)}`,
            channelId,
            content:   text,
            author:    socket.username || 'anonymous',
            email:     socket.email    || null,
            timestamp: Date.now(),
        }

        // Store in Redis list, cap at 200 messages
        await client.rPush(`channel:messages:${channelId}`, JSON.stringify(msg))
        await client.lTrim(`channel:messages:${channelId}`, -200, -1)

        // Bump channel score (for activity sorting)
        await client.zAdd('channels', { score: Date.now(), value: channelId }, { XX: true })

        // Broadcast to everyone in the channel (including sender)
        io.to(`ch:${channelId}`).emit('channel:message', msg)
    })

    socket.on('channel:delete_message', async ({ channelId, messageId }) => {
        // Only admins can delete — check admin key
        const adminKey = socket.handshake.auth.adminKey
        if (adminKey !== process.env.ADMIN_KEY) return

        const raw  = await client.lRange(`channel:messages:${channelId}`, 0, -1)
        const kept = raw.filter(m => JSON.parse(m).id !== messageId)
        await client.del(`channel:messages:${channelId}`)
        if (kept.length) await client.rPush(`channel:messages:${channelId}`, ...kept)
        io.to(`ch:${channelId}`).emit('channel:messageDeleted', { channelId, messageId })
    })

    // ── Disconnect cleanup ────────────────────────────────────
    socket.on('disconnect', () => {
        try {
            if (pendingConnects.has(socket.id)) {
                clearTimeout(pendingConnects.get(socket.id).timer)
                pendingConnects.delete(socket.id)
            }
            videoConsents.delete(socket.id)
            removeUser(socket.id)
            socket.removeAllListeners()
        } catch (error) {
            console.error('[disconnect cleanup]', error)
        }
    })
}
