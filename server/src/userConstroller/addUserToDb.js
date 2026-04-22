import client from "../redisClient.js";

// Returns the correct Redis queue key for this socket
export function getQueueKey(socket, forceShadow = false) {
    const domain = socket.collegeDomain || 'global'
    const shadow  = forceShadow || socket.shadowBanned
    return shadow ? `users:shadow:${domain}` : `users:${domain}`
}

export default async function addUserTODb(socket) {
    try {
        // Check if this user is shadow-banned
        const isShadowBanned = await client.sIsMember('shadowBanned', socket.id)
        socket.shadowBanned  = isShadowBanned

        const queueKey = getQueueKey(socket)
        const result   = await client.rPush(queueKey, JSON.stringify({
            socketId: socket.id,
            username: socket.username,
            collegeDomain: socket.collegeDomain || 'global',
        }))
        console.log(`[Queue] Added ${socket.username} → ${queueKey} (len=${result})`)
    } catch (err) {
        console.error('[addUserTODb]', err)
        socket.emit("errSelectingPair")
    }
}
