/**
 * In-memory record of recent call partnerships.
 * Used to verify that rateUser / reportUser targets were
 * actually paired with the sender — prevents abuse.
 *
 * socketId → Set<partnerSocketId>
 */
const recentPartners = new Map()

export function recordPartnership(idA, idB) {
    if (!recentPartners.has(idA)) recentPartners.set(idA, new Set())
    if (!recentPartners.has(idB)) recentPartners.set(idB, new Set())
    recentPartners.get(idA).add(idB)
    recentPartners.get(idB).add(idA)
}

export function werePartnered(idA, idB) {
    return recentPartners.has(idA) && recentPartners.get(idA).has(idB)
}

export function cleanupPartnership(socketId) {
    const partners = recentPartners.get(socketId)
    if (partners) {
        for (const partnerId of partners) {
            recentPartners.get(partnerId)?.delete(socketId)
        }
    }
    recentPartners.delete(socketId)
}
