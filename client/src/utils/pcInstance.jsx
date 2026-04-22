// ICE server configuration
// STUN: free, discovers public IP — works for ~80% of users
// TURN: relay server for users behind strict NAT/firewalls (~20%)
//
// For production: replace the TURN credentials with your own Coturn server
// Self-host on a ₹500/month VPS: github.com/coturn/coturn
// Or use a managed service: Metered.ca (free tier: 50GB/month)

const ICE_SERVERS = [
    // Google STUN (free, always use this)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },

    // Public TURN servers (limited bandwidth — replace with own in production)
    // Metered.ca free tier — good for development/testing
    ...(import.meta.env.VITE_TURN_URL ? [{
        urls:       import.meta.env.VITE_TURN_URL,
        username:   import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
    }] : []),
]

export default function setPcInstance() {
    const pcInstance = new RTCPeerConnection({
        iceServers:           ICE_SERVERS,
        iceCandidatePoolSize: 10,
    })
    return pcInstance
}
