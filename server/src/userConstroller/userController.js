import client from "../redisClient.js";
import makePair from "./makePair.js";
import addUserTODb, { getQueueKey } from "./addUserToDb.js";

// Broadcast waiting count for this socket's college to everyone in that waiting room
export async function emitLiveCount(io, socket) {
    try {
        const queueKey = getQueueKey(socket)
        const count    = await client.lLen(queueKey)
        const room     = `waiting:${socket.collegeDomain || 'global'}`
        io.to(room).emit('liveCount', count)
    } catch (err) {
        console.error('[emitLiveCount]', err)
    }
}

export async function processUserPairing(io, socket) {
    try {
        // Check if email is banned
        if (socket.email) {
            const banned = await client.sIsMember('banned:emails', socket.email)
            if (banned) {
                socket.emit('accountSuspended', 'Your account has been suspended.')
                socket.disconnect(true)
                return
            }
        }

        const queueKey = getQueueKey(socket)
        const userLen  = await client.lLen(queueKey)
        const room     = `waiting:${socket.collegeDomain || 'global'}`

        if (userLen <= 0) {
            // Nobody waiting — add self to queue
            const check = await soloUserLeftTheChat(socket)
            if (check > 0) throw new Error("duplicate user in queue: " + socket.username)

            await addUserTODb(socket)
            socket.join(room)
            io.to(socket.id).emit("waiting", "Waiting for another user to join")
            emitLiveCount(io, socket)
        } else {
            // Someone waiting — make a pair
            const userPair = await makePair(userLen, socket)
            if (!userPair) throw new Error("error selecting pair: " + socket.username)

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
        const queueKey = getQueueKey(socket)
        const check    = await client.lRem(queueKey, 1, JSON.stringify({
            socketId:      socket.id,
            username:      socket.username,
            collegeDomain: socket.collegeDomain || 'global',
        }))
        console.log(`[Queue] ${socket.username} removed from ${queueKey}:`, check)
        return check
    } catch (err) {
        console.error('[soloUserLeftTheChat]', err)
    }
}
