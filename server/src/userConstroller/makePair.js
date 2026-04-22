import client from "../redisClient.js";
import addUserTODb, { getQueueKey } from "./addUserToDb.js";

function createUserPair(socket, randomUserData) {
    const user1 = {
        socketId:        socket.id,
        username:        socket.username,
        polite:          true,
        pairedUserId:    randomUserData.socketId,
        strangerUsername: randomUserData.username,
    };
    const user2 = {
        socketId:        randomUserData.socketId,
        username:        randomUserData.username,
        polite:          false,
        pairedUserId:    socket.id,
        strangerUsername: socket.username,
    };
    return [user1, user2];
}

export default async function makePair(len, socket) {
    const queueKey       = getQueueKey(socket)
    const getRandomIndex = () => Math.floor(Math.random() * len)

    try {
        const strangerIndex  = getRandomIndex()
        const randomUserData = await client.lIndex(queueKey, strangerIndex)

        if (!randomUserData) {
            socket.emit("errMakingPair", "No user found")
            return null
        }

        const removedCount = await client.lRem(queueKey, 1, randomUserData)
        if (removedCount === 0) {
            socket.emit("errMakingPair", "User no longer available")
            return null
        }

        const parsedUserData = JSON.parse(randomUserData)
        const users          = createUserPair(socket, parsedUserData)
        console.log(`[Pair] ${users[0].username} ↔ ${users[1].username} (queue: ${queueKey})`)

        if (users[0].socketId === users[1].socketId) {
            socket.emit("waiting", "Waiting for another user to join")
            addUserTODb(socket)
            return null
        }

        return users

    } catch (err) {
        console.error('[makePair]', err)
        socket.emit("errMakingPair", "Internal server error")
        return null
    }
}
