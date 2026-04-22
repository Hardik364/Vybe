import client from "../redisClient.js";
import makePair from "./makePair.js";
import addUserTODb from "./addUserToDb.js";
import { getSelfQueue } from "../utils/tierMatching.js";
import { updateStatus } from "../userRegistry.js";

// Broadcast waiting count for this socket's college queue
export async function emitLiveCount(io, socket) {
    try {
        const queueKey = getSelfQueue(socket)
        const count    = await client.lLen(queueKey)
        const room     = `waiting:${socket.collegeDomain || 'global'}`
        io.to(room).emit('liveCount', count)
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

        // Try to find a match across tier-appropriate queues
        const userPair = await makePair(socket)

        if (!userPair) {
            // Nobody available — add self to waiting queue
            await soloUserLeftTheChat(socket)   // clean up stale entry first
            await addUserTODb(socket)

            const room = `waiting:${socket.collegeDomain || 'global'}`
            socket.join(room)
            io.to(socket.id).emit("waiting", "Waiting for another user to join")
            emitLiveCount(io, socket)
        } else {
            // Paired — notify both sockets and update registry
            const room = `waiting:${socket.collegeDomain || 'global'}`
            updateStatus(userPair[0].socketId, 'in-call', userPair[1].socketId, userPair[1].username)
            updateStatus(userPair[1].socketId, 'in-call', userPair[0].socketId, userPair[0].username)
            userPair.forEach(key => {
                const s = io.sockets.sockets.get(key.socketId)
                if (s) s.leave(room)
                io.to(key.socketId).emit("getStragerData", key)
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
