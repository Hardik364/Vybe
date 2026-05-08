import client from "../redisClient.js";
import makePair from "./makePair.js";
import addUserTODb from "./addUserToDb.js";
import { getSelfQueue } from "../utils/tierMatching.js";
import { updateStatus } from "../userRegistry.js";
import { recordPartnership } from "../partnerships.js";
import { sendCollegeNotifications } from "../pushNotify.js";
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const _prompts   = JSON.parse(readFileSync(join(__dirname, '../data/prompts.json'), 'utf8'))

function pickPrompt() {
    return _prompts[Math.floor(Math.random() * _prompts.length)]
}

// Broadcast total online count for this socket's college
// Uses the persistent college: room (everyone, waiting + in-call)
// and also notifies users currently in calls via the college room directly.
export async function emitLiveCount(io, socket) {
    try {
        const domain      = socket.collegeDomain || 'global'
        const collegeRoom = `college:${domain}`
        const roomSet     = io.sockets.adapter.rooms.get(collegeRoom)
        const count       = roomSet ? roomSet.size : 0
        // Broadcast to everyone in this college (waiting + in-call)
        io.to(collegeRoom).emit('liveCount', count)
    } catch (err) {
        console.error('[emitLiveCount]', err)
    }
}

export async function processUserPairing(io, socket) {
    try {
        // Block banned accounts
        if (socket.email) {
            const banned = await client.sIsMember('banned:emails', socket.email)
            if (banned) {
                socket.emit('accountSuspended', 'Your account has been suspended.')
                socket.disconnect(true)
                return
            }
        }

        // ── Load tier + shadow ban BEFORE makePair so queue routing is correct ──
        // socket.tier and socket.shadowBanned are used by getMatchQueues / getSelfQueue.
        // We must resolve them here so every matchmaking path has the right values.
        if (!socket.tier) {
            if (socket.email) {
                const [tier, shadowByEmail] = await Promise.all([
                    client.get(`tier:${socket.email}`),
                    client.sIsMember('shadowBanned:emails', socket.email),
                ])
                socket.tier        = tier || 'free'
                socket.shadowBanned = shadowByEmail || (await client.sIsMember('shadowBanned', socket.id))
            } else {
                socket.tier        = 'free'
                socket.shadowBanned = await client.sIsMember('shadowBanned', socket.id)
            }
        }

        // Try to find a match across tier-appropriate queues
        const userPair = await makePair(socket)

        if (!userPair) {
            // Nobody available — add self to waiting queue
            await soloUserLeftTheChat(socket)   // clean up stale entry first
            const queueKey    = getSelfQueue(socket)
            const prevCount   = await client.lLen(queueKey)
            await addUserTODb(socket)

            const room = `waiting:${socket.collegeDomain || 'global'}`
            socket.join(room)
            io.to(socket.id).emit("waiting", "Waiting for another user to join")
            emitLiveCount(io, socket)

            // 0 → 1 transition: notify waitlisted users for this college
            if (prevCount === 0) {
                sendCollegeNotifications(socket.collegeDomain || 'global').catch(err =>
                    console.error('[Push] sendCollegeNotifications error:', err)
                )
            }
        } else {
            // Paired — notify both sockets and update registry
            const room = `waiting:${socket.collegeDomain || 'global'}`
            updateStatus(userPair[0].socketId, 'in-call', userPair[1].socketId, userPair[1].username)
            updateStatus(userPair[1].socketId, 'in-call', userPair[0].socketId, userPair[0].username)
            // Record partnership so rateUser / reportUser can verify both were in a call
            recordPartnership(userPair[0].socketId, userPair[1].socketId)
            // Pick one prompt — both users see the same one on match
            const matchPrompt = pickPrompt()

            // ── Count this call against any guest sockets ─────
            for (const key of userPair) {
                const s = io.sockets.sockets.get(key.socketId)
                if (s?.isGuest && s.deviceId) {
                    const k = `guest_calls:device:${s.deviceId}`
                    client.incr(k).then(() => client.expire(k, 24 * 60 * 60)).catch(() => {})
                }
            }

            userPair.forEach(key => {
                const s = io.sockets.sockets.get(key.socketId)
                if (s) s.leave(room)
                io.to(key.socketId).emit("getStragerData", { ...key, prompt: matchPrompt })
            })
            emitLiveCount(io, socket)
        }
    } catch (err) {
        socket.emit("errSelectingPair")
        console.error('[processUserPairing]', err)
    }
}

export async function soloUserLeftTheChat(socket) {
    try {
        const queueKey = getSelfQueue(socket)
        const check    = await client.lRem(queueKey, 1, JSON.stringify({
            socketId:      socket.id,
            username:      socket.username,
            collegeDomain: socket.collegeDomain || 'global',
            tier:          socket.tier || 'free',
        }))
        if (check > 0) console.log(`[Queue] ${socket.username} removed from ${queueKey}`)
        return check
    } catch (err) {
        console.error('[soloUserLeftTheChat]', err)
    }
}
