import client from "../redisClient.js";
import makePair from "./makePair.js";
import addUserTODb from "./addUserToDb.js";

// Broadcast current waiting queue length to all sockets in the 'waiting' room
export async function emitLiveCount(io) {
    try {
        const count = await client.lLen("users")
        io.to('waiting').emit('liveCount', count)
    } catch (err) {
        console.error('[emitLiveCount]', err)
    }
}

export async function processUserPairing(io, socket) {
    try {
        const userLen = await client.lLen("users");
        if (userLen <= 0) {
            const check = await soloUserLeftTheChat(socket);
            if (check > 0) throw new Error("duplicate user found " + socket.username);

            await addUserTODb(socket);
            io.to(socket.id).emit("waiting", "Waiting for another user to join")
            emitLiveCount(io)
        } else {
            const userPair = await makePair(userLen, socket)
            if (!userPair) throw new Error("error selecting pair " + socket.username);

            // Remove both from the waiting room and broadcast updated count
            userPair.forEach(key => {
                const s = io.sockets.sockets.get(key.socketId)
                if (s) s.leave('waiting')
                io.to(key.socketId).emit("getStragerData", key)
            })
            emitLiveCount(io)
        }
    } catch (err) {
        socket.emit("errSelectingPair");
        console.log(err);
    }
}

export async function soloUserLeftTheChat(socket) {
    try {
        const check = await client.lRem("users", 1, JSON.stringify({
            'socketId': socket.id,
            'username': socket.username
        }));
        console.log(socket.username, "left the chat", check);
        return check;
    } catch (err) {
        console.log(err);
    }
}
