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

        // Don't pair with self
        if (parsedUserData.socketId === socket.id) {
            // Put them back and keep searching
            await client.rPush(queueKey, rawUserData)
            continue
        }

        const users = createUserPair(socket, parsedUserData)
        console.log(`[Pair] ${users[0].username} ↔ ${users[1].username} (queue: ${queueKey})`)
        return users
    }

    return null   // nobody available in any queue
}
