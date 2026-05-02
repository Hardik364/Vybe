import client from "../redisClient.js";
import addUserTODb from "./addUserToDb.js";
import { getMatchQueues, getSelfQueue } from "../utils/tierMatching.js";

function createUserPair(socket, randomUserData) {
    return [
        {
            socketId:        socket.id,
            username:        socket.username,
            polite:          true,
            pairedUserId:    randomUserData.socketId,
            strangerUsername: randomUserData.username,
        },
        {
            socketId:        randomUserData.socketId,
            username:        randomUserData.username,
            polite:          false,
            pairedUserId:    socket.id,
            strangerUsername: socket.username,
        },
    ]
}

export default async function makePair(socket) {
    // Try each queue in tier-priority order
    const queues = getMatchQueues(socket)

    for (const queueKey of queues) {
        const len = await client.lLen(queueKey)
        if (len <= 0) continue

        const randomIndex    = Math.floor(Math.random() * len)
        const rawUserData    = await client.lIndex(queueKey, randomIndex)
        if (!rawUserData) continue

        const removedCount = await client.lRem(queueKey, 1, rawUserData)
        if (removedCount === 0) continue   // race condition — someone else grabbed them

        const parsedUserData = JSON.parse(rawUserData)

        // Don't pair with self — check socket ID, username, AND email.
        // - socketId:  catches same tab reconnecting fast
        // - username:  catches ghost entries from refresh (same session)
        // - email:     catches same person logging in twice with different
        //              usernames (e.g. re-registering with same college email)
        const isSelf = parsedUserData.socketId === socket.id ||
                       (parsedUserData.username &&
                        parsedUserData.username === socket.username) ||
                       (socket.email && parsedUserData.email &&
                        socket.email === parsedUserData.email)
        if (isSelf) {
            // Discard ghost entry — it's the same person, don't put it back
            console.log(`[Pair] Discarded ghost entry for ${socket.username} (${socket.email || 'guest'})`)
            continue
        }

        const users = createUserPair(socket, parsedUserData)
        console.log(`[Pair] ${users[0].username} ↔ ${users[1].username} (queue: ${queueKey})`)
        return users
    }

    return null   // nobody available in any queue
}
