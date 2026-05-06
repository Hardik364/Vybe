const FALLBACK_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

let cachedIceServers = null

export async function initIceServers() {
  if (cachedIceServers) return cachedIceServers
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL}/api/ice-servers`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const servers = await res.json()
    if (Array.isArray(servers) && servers.length) {
      cachedIceServers = servers
    } else {
      throw new Error('Empty ICE server list')
    }
  } catch (err) {
    console.warn('[ICE] Using STUN fallback:', err.message)
    cachedIceServers = FALLBACK_ICE
  }
  return cachedIceServers
}

export default function setPcInstance() {
  const iceServers = cachedIceServers || FALLBACK_ICE
  return new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 })
}
