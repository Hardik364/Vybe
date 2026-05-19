import client from "../redisClient.js";
import addUserTODb from "./addUserToDb.js";
import { getMatchQueues, getSelfQueue } from "../utils/tierMatching.js";

// Bidirectional gender preference check.
// A match is only made if BOTH users accept each other's gender.
// 'anyone' is always accepted on either side.
function genderCompatible(socket, candidate) {
    const myGender    = socket.gender        || 'unspecified'
    const myPref      = socket.genderPref    || 'anyone'
    const theirGender = candidate.gender     || 'unspecified'
    const theirPref   = candidate.genderPref || 'anyone'

    const iAcceptThem  = myPref    === 'anyone' || myPref    === theirGender
    const theyAcceptMe = theirPref === 'anyone' || theirPref === myGender

    return iAcceptThem && theyAcceptMe
}

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

        // Try up to min(5, len) random candidates per queue.
        // We skip (don't remove) gender-incompatible entries so they stay
        // available for other users. Self-matches are discarded.
        const maxAttempts  = Math.min(5, len)
        const triedIndexes = new Set()

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Pick a random index not yet tried this round
            let randomIndex, safety = 0
            do {
                randomIndex = Math.floor(Math.random() * len)
                safety++
            } while (triedIndexes.has(randomIndex) && safety < 20)
            triedIndexes.add(randomIndex)

            const rawUserData = await client.lIndex(queueKey, randomIndex)
            if (!rawUserData) continue

            const parsedUserData = JSON.parse(rawUserData)

            // Don't pair with self — check socket ID, username, AND email.
            // - socketId:  catches same tab reconnecting fast
            // - username:  catches ghost entries from refresh (same session)
            // - email:     catches same person logging in twice with different usernames
            const isSelf = parsedUserData.socketId === socket.id ||
                           (parsedUserData.username &&
                            parsedUserData.username === socket.username) ||
                           (socket.email && parsedUserData.email &&
                            socket.email === parsedUserData.email)
            if (isSelf) {
                // Discard ghost entry — same person, don't put it back
                await client.lRem(queueKey, 1, rawUserData)
                console.log(`[Pair] Discarded ghost entry for ${socket.username} (${socket.email || 'guest'})`)
                continue
            }

            // Gender preference check — skip (leave in queue) if incompatible
            if (!genderCompatible(socket, parsedUserData)) continue

            // Try to atomically remove the entry (race-condition protection)
            const removedCount = await client.lRem(queueKey, 1, rawUserData)
            if (removedCount === 0) continue   // someone else grabbed them first

            const users = createUserPair(socket, parsedUserData)
            console.log(`[Pair] ${users[0].username} ↔ ${users[1].username} (queue: ${queueKey})`)
            return users
        }
    }

    return null   // nobody compatible available in any queue
}
