import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useRouter } from 'next/navigation'
import setPcInstance from '@/utils/pcInstance'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function useSocket(
  username, remoteVideoRef, setMessage, updateUser, peerConnection, setPeerConnection, setStrangerData
) {
  const [socket, setSocket] = useState(null)
  const [strangerUserId, setStrangerUserId] = useState('')
  const [strangerUsername, setStrangerUsername] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!username) { router.push('/signup'); return }

    const token    = localStorage.getItem('ub_token')
    const isGuest  = localStorage.getItem('ub_guest') === '1'
    const deviceId = localStorage.getItem('ub_device_id') || undefined

    const newSocket = io(API, {
      transports: ['websocket'],
      auth: {
        username,
        token:    token    || undefined,
        isGuest:  isGuest  || undefined,
        deviceId: isGuest ? deviceId : undefined,
      },
    })
    setSocket(newSocket)

    newSocket.on('guestLimitReached', () => {
      localStorage.setItem('ub_guest_limit', '1')
      router.push('/signup')
    })

    return () => { newSocket.disconnect(); setSocket(null) }
  }, [username])

  // Auto-start search
  useEffect(() => {
    if (socket && !strangerUsername) socket.emit('startConnection')
  }, [socket, strangerUsername])

  // Core socket events
  useEffect(() => {
    if (!socket) return
    socket.on('getStragerData', data => {
      setStrangerData(data)
      setStrangerUserId(data.pairedUserId)
      setStrangerUsername(data.strangerUsername)
      setConnectionStatus(true)
    })
    socket.on('strangerLeftTheChat', clearState)
    socket.on('errMakingPair', () => socket.emit('startConnection'))
    socket.on('accountSuspended', msg => {
      localStorage.removeItem('ub_token')
      alert(`⛔ ${msg}`)
      router.push('/signup')
    })
    return () => {
      socket.removeAllListeners('getStragerData')
      socket.removeAllListeners('strangerLeftTheChat')
      socket.removeAllListeners('errMakingPair')
      socket.removeAllListeners('accountSuspended')
    }
  }, [socket])

  function clearState() {
    setStrangerData(null)
    setStrangerUserId('')
    setStrangerUsername(null)
    setConnectionStatus(false)
    if (remoteVideoRef?.current) remoteVideoRef.current.srcObject = null
    setMessage([])
    if (peerConnection?.signalingState !== 'closed') peerConnection?.close()
    setPeerConnection(setPcInstance())
  }

  // updateUser (next person)
  useEffect(() => {
    if (updateUser > 0) {
      const prevId = strangerUserId
      clearState()
      if (prevId && socket) socket.emit('pairedUserLeftTheChat', prevId)
    }
  }, [updateUser])

  // Beforeunload
  useEffect(() => {
    if (!socket) return
    const handler = () => {
      if (strangerUsername) socket.emit('pairedUserLeftTheChat', strangerUserId)
      else socket.emit('soloUserLeftTheChat')
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [socket, strangerUsername, strangerUserId])

  return { socket, strangerUserId, strangerUsername, connectionStatus }
}
