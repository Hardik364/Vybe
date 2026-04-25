// ICE server config — fetched from the server at startup so TURN credentials
// never appear in the client bundle or Vite env vars.
//
// Call initIceServers() once on app mount (App.jsx).
// setPcInstance() uses the cached result from that point on.

const FALLBACK_ICE = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
]

let cachedIceServers = null  // populated by initIceServers()

// Fetch once and cache.  Called from App.jsx on mount.
export async function initIceServers() {
    if (cachedIceServers) return cachedIceServers
    try {
        const res = await fetch(
            `${import.meta.env.VITE_APP_WEBSOCKET_URL}/api/ice-servers`,
            { signal: AbortSignal.timeout(4000) }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const servers = await res.json()
        if (Array.isArray(servers) && servers.length) {
            cachedIceServers = servers
            console.log(`[ICE] Loaded ${servers.length} server(s) from API`)
        } else {
            throw new Error('Empty ICE server list')
        }
    } catch (err) {
        console.warn('[ICE] Could not fetch ICE servers — using STUN fallback:', err.message)
        cachedIceServers = FALLBACK_ICE
    }
    return cachedIceServers
}

// Synchronous factory — safe to call once initIceServers() has resolved.
export default function setPcInstance() {
    const iceServers = cachedIceServers || FALLBACK_ICE
    return new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
    })
}
