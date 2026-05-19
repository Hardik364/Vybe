import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useRouter } from 'next/navigation'
import setPcInstance from '@/utils/pcInstance'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function useSocket(
  username, remoteVideoRef, setMessage, updateUser, peerConnection, setPeerConnection, setStrangerData,
  genderPref,
  inModal   // ← true while PostCallScreen or KarmaModal is visible
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
  const peerConnectionRef   = useRef(null)
  // When a modal (PostCallScreen / KarmaModal) is open we MUST NOT:
  //   • call clearState() from strangerLeftTheChat  (would re-queue too early)
  //   • fire auto-start startConnection             (same reason)
  const inModalRef          = useRef(false)

  useEffect(() => { strangerUserIdRef.current  = strangerUserId  }, [strangerUserId])
  useEffect(() => { strangerUsernameRef.current = strangerUsername }, [strangerUsername])
  useEffect(() => { peerConnectionRef.current  = peerConnection  }, [peerConnection])
  useEffect(() => { inModalRef.current         = inModal         }, [inModal])

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

  // ── Auto-start: emit startConnection when idle (no partner, no modal).
  //   CRITICAL: guard with inModalRef so a strangerLeftTheChat that fires
  //   while PostCallScreen/KarmaModal is open doesn't re-queue prematurely.
  useEffect(() => {
    if (socket && !strangerUsername && !inModalRef.current) {
      socket.emit('startConnection')
    }
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

    // strangerLeftTheChat:
    //   • If no modal is open → clear state immediately (auto-start re-queues).
    //   • If a modal IS open → block clearState here; PostCallScreen's own
    //     listener calls safeMoveOn() which closes the modal chain, and
    //     clearState is called by the updateUser effect after KarmaModal.
    socket.on('strangerLeftTheChat', () => {
      if (!inModalRef.current) {
        clearState()
      }
      // When inModal=true, PostCallScreen handles it via safeMoveOn()
    })

    socket.on('errMakingPair', () => {
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

  // ── updateUser (called after KarmaModal is done, or Next while not in call).
  //   clearState() here sets strangerUsername → null → auto-start re-queues.
  //   We do NOT emit pairedUserLeftTheChat here — that was already sent by
  //   handleNewUser the moment the user clicked Next (before PostCallScreen).
  useEffect(() => {
    if (updateUser > 0) {
      clearState()
    }
  }, [updateUser])

  // ── Beforeunload: best-effort notification so partner isn't frozen ──
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
