import client from "../redisClient.js";
import { getSelfQueue } from "../utils/tierMatching.js";

export default async function addUserTODb(socket) {
    try {
        // Check shadow ban: by email (persistent across reconnects) or by socket ID (legacy)
        let isShadowBanned = false
        if (socket.email) {
            isShadowBanned = await client.sIsMember('shadowBanned:emails', socket.email)
        }
        if (!isShadowBanned) {
            isShadowBanned = await client.sIsMember('shadowBanned', socket.id)
        }
        socket.shadowBanned = isShadowBanned

        // Get tier from Redis (set when user upgrades; default = 'free')
        if (socket.email) {
            const tier = await client.get(`tier:${socket.email}`)
            socket.tier = tier || 'free'
        } else {
            socket.tier = 'free'
        }

        const queueKey = getSelfQueue(socket)
        const result   = await client.rPush(queueKey, JSON.stringify({
            socketId:      socket.id,
            username:      socket.username,
            email:         socket.email || null,   // used to prevent same-email self-match
            collegeDomain: socket.collegeDomain || 'global',
            tier:          socket.tier,
        }))
        console.log(`[Queue] ${socket.username} (${socket.tier}) → ${queueKey} (len=${result})`)
    } catch (err) {
        console.error('[addUserTODb]', err)
        socket.emit("errSelectingPair")
    }
}
