import client from "../redisClient.js";
import makePair from "./makePair.js";
import addUserTODb from "./addUserToDb.js";
import { getSelfQueue } from "../utils/tierMatching.js";
import { updateStatus } from "../userRegistry.js";
import registry from "../userRegistry.js";
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

// Broadcast live gender breakdown to ALL connected sockets.
// Scans the in-memory registry — no Redis needed.
export function emitGenderStats(io) {
    try {
        const counts = { male: 0, female: 0, transgender: 0 }
        for (const user of registry.values()) {
            if (counts[user.gender] !== undefined) counts[user.gender]++
        }
        const total = counts.male + counts.female + counts.transgender
        io.emit('genderStats', {
            male:           counts.male,
            female:         counts.female,
            transgender:    counts.transgender,
            total,
            pctMale:        total > 0 ? Math.round(counts.male        / total * 100) : 0,
            pctFemale:      total > 0 ? Math.round(counts.female      / total * 100) : 0,
            pctTransgender: total > 0 ? Math.round(counts.transgender / total * 100) : 0,
        })
    } catch (err) {
        console.error('[emitGenderStats]', err)
    }
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
            emitGenderStats(io)

            // 0 → 1 transition: notify waitlisted users for this college
            if (prevCount === 0) {
                sendCollegeNotifications(socket.collegeDomain || 'global').catch(err =>
                    console.error('[Push] sendCollegeNotifications error:', err)
                )
            }
        } else {
            // ── Liveness check: both sockets must still be connected ──────
            // Between makePair's lRem and here, a socket may have disconnected.
            // io.to(deadId).emit() is a silent no-op, leaving the other user
            // stuck in a dead call forever with no ICE candidates arriving.
            const liveS0 = io.sockets.sockets.get(userPair[0].socketId)
            const liveS1 = io.sockets.sockets.get(userPair[1].socketId)
            if (!liveS0 || !liveS1) {
                console.warn('[processUserPairing] Ghost match — one socket disconnected between queue-pop and pair. Re-queuing survivor.')
                // Re-queue the surviving socket by emitting errMakingPair
                // (client's errMakingPair handler calls startConnection again)
                const survivor = liveS0 || liveS1
                if (survivor) survivor.emit('errMakingPair')
                return
            }

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
            emitGenderStats(io)
        }
    } catch (err) {
        socket.emit("errMakingPair")
        console.error('[processUserPairing]', err)
    }
}

export async function soloUserLeftTheChat(socket) {
    try {
        const queueKey = getSelfQueue(socket)
        // Must match the exact JSON that addUserToDb pushed — including gender/genderPref
        const check    = await client.lRem(queueKey, 1, JSON.stringify({
            socketId:      socket.id,
            username:      socket.username,
            email:         socket.email    || null,
            collegeDomain: socket.collegeDomain || 'global',
            userState:     socket.userState || null,
            tier:          socket.tier || 'free',
            gender:        socket.gender    || 'unspecified',
            genderPref:    socket.genderPref || 'anyone',
        }))
        if (check > 0) console.log(`[Queue] ${socket.username} removed from ${queueKey}`)
        return check
    } catch (err) {
        console.error('[soloUserLeftTheChat]', err)
    }
}
