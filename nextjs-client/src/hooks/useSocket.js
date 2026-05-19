import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useRouter } from 'next/navigation'
import setPcInstance from '@/utils/pcInstance'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function useSocket(
  username, remoteVideoRef, setMessage, updateUser, peerConnection, setPeerConnection, setStrangerData,
  genderPref
) {
  const [socket, setSocket] = useState(null)
  const [strangerUserId, setStrangerUserId] = useState('')
  const [strangerUsername, setStrangerUsername] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(false)
  const [genderStats, setGenderStats] = useState(null)
  const router = useRouter()

  // ── Refs: always point to current values so closures in effects with
  //         narrow dep-arrays never read stale data. ──────────────────
  const strangerUserIdRef   = useRef('')
  const strangerUsernameRef = useRef(null)
  const socketRef           = useRef(null)
  // peerConnection comes in as a prop — mirror it into a ref so clearState
  // always closes the *current* RTCPeerConnection, not the one from mount.
  const peerConnectionRef   = useRef(null)

  useEffect(() => { strangerUserIdRef.current  = strangerUserId  }, [strangerUserId])
  useEffect(() => { strangerUsernameRef.current = strangerUsername }, [strangerUsername])
  useEffect(() => { peerConnectionRef.current  = peerConnection  }, [peerConnection])

  // ── Socket creation ───────────────────────────────────────────────
  useEffect(() => {
    if (!username) return

    const token    = localStorage.getItem('ub_token')
    const isGuest  = localStorage.getItem('ub_guest') === '1'
    const deviceId = localStorage.getItem('ub_device_id') || undefined

    const newSocket = io(API, {
      transports: ['websocket'],
      auth: {
        username,
        token:      token      || undefined,
        isGuest:    isGuest    || undefined,
        deviceId:   isGuest ? deviceId : undefined,
        genderPref: genderPref || 'anyone',
      },
    })
    setSocket(newSocket)
    socketRef.current = newSocket

    newSocket.on('guestLimitReached', () => {
      // Socket is still alive — notify partner before leaving
      const partnerId = strangerUserIdRef.current
      if (partnerId) newSocket.emit('pairedUserLeftTheChat', partnerId)

      localStorage.removeItem('ub_token')
      localStorage.removeItem('ub_username')
      localStorage.removeItem('ub_guest')
      localStorage.setItem('ub_guest_limit', '1')
      router.push('/signup')
    })

    return () => {
      newSocket.disconnect()
      setSocket(null)
      socketRef.current = null
    }
  }, [username])

  // ── Auto-start: THE SOLE source of startConnection emits. ────────
  // Fires when: (1) socket first created, (2) strangerUsername → null
  // (which happens every time clearState() is called after a call ends).
  // By removing explicit startConnection emits from strangerLeftTheChat
  // and updateUser, we guarantee at most ONE emit per call-end, so the
  // rate-limit of 3/3s is never approached in normal usage.
  useEffect(() => {
    if (socket && !strangerUsername) socket.emit('startConnection')
  }, [socket, strangerUsername])

  // ── Core socket events ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    socket.on('getStragerData', data => {
      setStrangerData(data)
      setStrangerUserId(data.pairedUserId)
      setStrangerUsername(data.strangerUsername)
      setConnectionStatus(true)
    })

    // strangerLeftTheChat: clear state ONLY — auto-start effect handles re-queue.
    // Do NOT emit startConnection here: that would double-emit alongside the
    // auto-start effect, wasting a rate-limit slot and risking the 3/3s cap.
    socket.on('strangerLeftTheChat', () => {
      clearState()
    })

    socket.on('errMakingPair', () => {
      // Server failed to pair us (Redis error, ghost match, etc.).
      // Brief delay so we don't spam if the error is persistent.
      setTimeout(() => socketRef.current?.emit('startConnection'), 800)
    })

    socket.on('accountSuspended', msg => {
      localStorage.removeItem('ub_token')
      alert(`⛔ ${msg}`)
      router.push('/signup')
    })

    socket.on('genderStats', stats => setGenderStats(stats))

    return () => {
      socket.removeAllListeners('getStragerData')
      socket.removeAllListeners('strangerLeftTheChat')
      socket.removeAllListeners('errMakingPair')
      socket.removeAllListeners('accountSuspended')
      socket.removeAllListeners('genderStats')
    }
  }, [socket])

  // ── clearState: uses peerConnectionRef so it always closes the ──
  //   current RTCPeerConnection, not a stale closure value.
  function clearState() {
    setStrangerData(null)
    setStrangerUserId('')
    setStrangerUsername(null)
    setConnectionStatus(false)
    if (remoteVideoRef?.current) remoteVideoRef.current.srcObject = null
    setMessage([])
    const pc = peerConnectionRef.current
    if (pc?.signalingState !== 'closed') pc?.close()
    setPeerConnection(setPcInstance())
  }

  // ── updateUser (Next button): notify partner + clear state. ──────
  // Re-queue is handled by the auto-start effect (strangerUsername → null).
  useEffect(() => {
    if (updateUser > 0) {
      const prevId = strangerUserIdRef.current
      const sock   = socketRef.current
      clearState()
      if (prevId && sock) sock.emit('pairedUserLeftTheChat', prevId)
      // NO explicit startConnection here — auto-start fires from strangerUsername→null
    }
  }, [updateUser])

  // ── Beforeunload: registered once per socket, refs keep values current ─
  useEffect(() => {
    if (!socket) return
    const handler = () => {
      if (strangerUsernameRef.current) socket.emit('pairedUserLeftTheChat', strangerUserIdRef.current)
      else socket.emit('soloUserLeftTheChat')
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [socket])

  return { socket, strangerUserId, strangerUsername, connectionStatus, genderStats }
}
