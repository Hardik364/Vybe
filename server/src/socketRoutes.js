import { processUserPairing, soloUserLeftTheChat, emitLiveCount } from "./userConstroller/userController.js"
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
const videoConsents = new Map()

export function handelSocketConnection(io, socket) {

    // ── Pairing ─────────────────────────────────────────────
    socket.on("startConnection", () => {
        socket.join('waiting')
        processUserPairing(io, socket)
    })

    socket.on("pairedUserLeftTheChat", to => {
        io.to(to).emit("strangerLeftTheChat")
        emitLiveCount(io)
    })

    socket.on("soloUserLeftTheChat", () => {
        soloUserLeftTheChat(socket)
        socket.leave('waiting')
        emitLiveCount(io)
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

    // ── Video Consent (voice-first mutual opt-in) ────────────
    socket.on('videoConsentOn', ({ to }) => {
        if (!videoConsents.has(to)) videoConsents.set(to, new Set())
        videoConsents.get(to).add(socket.id)

        // Tell the partner this user wants video
        io.to(to).emit('partnerWantsVideo')

        // If the partner already consented too → both get the green light
        const partnerConsents = videoConsents.get(socket.id)
        if (partnerConsents && partnerConsents.has(to)) {
            io.to(socket.id).emit('videoBothConsented')
            io.to(to).emit('videoBothConsented')
            // clean up
            videoConsents.delete(socket.id)
            videoConsents.delete(to)
        }
    })

    socket.on('videoConsentOff', ({ to }) => {
        // Revoke consent
        if (videoConsents.has(to)) videoConsents.get(to).delete(socket.id)
        io.to(to).emit('partnerTurnedOffVideo')
        io.to(socket.id).emit('videoDisabled')
    })

    // ── Connect / Move On ────────────────────────────────────
    socket.on('connectRequest', ({ to }) => {
        if (pendingConnects.has(to) && pendingConnects.get(to).partnerId === socket.id) {
            // Both pressed Connect — exchange contacts
            clearTimeout(pendingConnects.get(to).timer)
            pendingConnects.delete(to)
            pendingConnects.delete(socket.id)
            io.to(socket.id).emit('contactsExchanged')
            io.to(to).emit('contactsExchanged')
        } else {
            // First to press — wait up to 31s for partner
            const timer = setTimeout(() => {
                pendingConnects.delete(socket.id)
                io.to(socket.id).emit('connectExpired')
            }, 31000)
            pendingConnects.set(socket.id, { partnerId: to, timer })
            io.to(socket.id).emit('connectPending')
        }
    })

    socket.on('cancelConnect', ({ to }) => {
        if (pendingConnects.has(socket.id)) {
            clearTimeout(pendingConnects.get(socket.id).timer)
            pendingConnects.delete(socket.id)
        }
    })

    socket.on('moveOn', ({ to }) => {
        // Clean up any pending connect
        if (pendingConnects.has(socket.id)) {
            clearTimeout(pendingConnects.get(socket.id).timer)
            pendingConnects.delete(socket.id)
        }
        // Let the partner know
        io.to(to).emit('partnerMovedOn')
    })

    // ── Karma Rating ─────────────────────────────────────────
    socket.on('rateUser', async ({ to, rating }) => {
        if (!rating || !to) return
        try {
            await client.hIncrBy(`karma:${to}`, rating, 1)
            await client.hIncrBy(`karma:${to}`, 'total', 1)

            // Shadow-ban check: if disrespectful > 20% of total calls
            const karma = await client.hGetAll(`karma:${to}`)
            const total = parseInt(karma.total || 0)
            const bad   = parseInt(karma.disrespectful || 0)
            if (total >= 5 && bad / total > 0.2) {
                await client.sAdd('shadowBanned', to)
                console.log(`[Karma] Shadow-banned socket ${to} (${bad}/${total} disrespectful)`)
            }
        } catch (err) {
            console.error('[rateUser] Redis error:', err)
        }
    })

    // ── Disconnect cleanup ───────────────────────────────────
    socket.on('disconnect', () => {
        try {
            // Clean up pending connect
            if (pendingConnects.has(socket.id)) {
                clearTimeout(pendingConnects.get(socket.id).timer)
                pendingConnects.delete(socket.id)
            }
            // Clean up video consent
            videoConsents.delete(socket.id)

            socket.removeAllListeners()
        } catch (error) {
            console.error(error)
        }
    })
}
