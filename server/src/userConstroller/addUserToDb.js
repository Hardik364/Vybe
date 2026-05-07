import client from "../redisClient.js";
import { getSelfQueue } from "../utils/tierMatching.js";
import { getUser } from "../db.js";

export default async function addUserTODb(socket) {
    try {
        // ── Shadow ban check ─────────────────────────────────────────────────
        // Check by email (persistent across reconnects) then by socket ID (legacy)
        let isShadowBanned = false
        if (socket.email) {
            isShadowBanned = await client.sIsMember('shadowBanned:emails', socket.email)
        }
        if (!isShadowBanned) {
            isShadowBanned = await client.sIsMember('shadowBanned', socket.id)
        }
        socket.shadowBanned = isShadowBanned

        // ── Tier + state loading ─────────────────────────────────────────────
        // Strategy: Redis is the hot cache, Supabase is the source of truth.
        // On first socket connect after a server restart, Redis is empty —
        // we fall back to Supabase and re-warm the cache.
        if (socket.email) {
            const [cachedTier, cachedState] = await Promise.all([
                client.get(`tier:${socket.email}`),
                client.get(`user:state:${socket.email}`),
            ])

            // If anything is missing from Redis, fetch the full user row once
            if (!cachedTier || !cachedState) {
                const user = await getUser(socket.email).catch(() => null)

                if (!cachedTier) {
                    const tier = user?.tier || 'free'
                    socket.tier = tier
                    // Only cache paid tiers — free has no TTL to set
                    if (tier !== 'free') {
                        await client.setEx(`tier:${socket.email}`, 30 * 24 * 60 * 60, tier)
                    }
                } else {
                    socket.tier = cachedTier
                }

                if (!cachedState) {
                    const state = user?.city || null   // city column stores the user's state
                    socket.userState = state
                    if (state) {
                        // Cache indefinitely — state doesn't change
                        await client.set(`user:state:${socket.email}`, state)
                    }
                } else {
                    socket.userState = cachedState
                }
            } else {
                // Both values in Redis — no DB call needed
                socket.tier      = cachedTier
                socket.userState = cachedState
            }
        } else {
            // Guest or unverified — no persistent data
            socket.tier      = 'free'
            socket.userState = null
        }

        // ── Add to waiting queue ─────────────────────────────────────────────
        const queueKey = getSelfQueue(socket)
        const result   = await client.rPush(queueKey, JSON.stringify({
            socketId:      socket.id,
            username:      socket.username,
            email:         socket.email    || null,
            collegeDomain: socket.collegeDomain || 'global',
            userState:     socket.userState || null,
            tier:          socket.tier,
        }))
        console.log(`[Queue] ${socket.username} (${socket.tier}, state=${socket.userState || 'unknown'}) → ${queueKey} (len=${result})`)
    } catch (err) {
        console.error('[addUserTODb]', err)
        socket.emit("errSelectingPair")
    }
}
