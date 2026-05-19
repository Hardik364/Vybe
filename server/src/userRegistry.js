// Live registry of every connected socket
// Map: socketId → UserRecord
const registry = new Map()

export function registerUser(socket) {
    registry.set(socket.id, {
        socketId:      socket.id,
        username:      socket.username      || 'anonymous',
        email:         socket.email         || null,
        collegeDomain: socket.collegeDomain || 'global',
        tier:          socket.tier          || 'free',
        shadowBanned:  socket.shadowBanned  || false,
        gender:        socket.gender        || 'unspecified',
        genderPref:    socket.genderPref    || 'anyone',
        status:        'connecting',     // connecting | waiting | in-call
        pairedWith:    null,             // socketId of partner
        pairedUsername: null,
        joinedAt:      Date.now(),
    })
}

export function updateGenderPref(socketId, genderPref) {
    const user = registry.get(socketId)
    if (!user) return
    registry.set(socketId, { ...user, genderPref })
}

export function updateStatus(socketId, status, pairedWith = null, pairedUsername = null) {
    const user = registry.get(socketId)
    if (!user) return
    registry.set(socketId, { ...user, status, pairedWith, pairedUsername })
}

export function removeUser(socketId) {
    registry.delete(socketId)
}

export function getSnapshot() {
    const now   = Date.now()
    const users = [...registry.values()].map(u => ({
        ...u,
        email:     u.email ? maskEmail(u.email) : null,
        onlineSec: Math.floor((now - u.joinedAt) / 1000),
    }))

    const connected   = users.length
    const waiting     = users.filter(u => u.status === 'waiting').length
    const inCall      = users.filter(u => u.status === 'in-call').length
    const activeCalls = Math.floor(inCall / 2)
    const shadowed    = users.filter(u => u.shadowBanned).length

    return { users, stats: { connected, waiting, activeCalls, shadowed } }
}

// Show only first 3 chars + domain: hardik*** @gmail.com
function maskEmail(email) {
    const [local, domain] = email.split('@')
    return `${local.slice(0, 3)}***@${domain}`
}

export default registry
