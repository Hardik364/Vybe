import { useEffect, useState, useRef, PureComponent } from "react"
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import setPcInstance from "../utils/pcInstance";

export default function useSocket(
    username, remoteVideo, setMessage, updateUser, peerConnection, setPeerConnection, setStrangerData) {
    const [socket, setSocket] = useState(null)
    const [strangerUserId, setStrangerUserId] = useState('')
    const [strangerUsername, setStrangerUsername] = useState(null)
    const [connectionStatus, setConnectionStatus] = useState(false)
    const [dummyStrangerUserId, setDummyStrangerUserId] = useState(null)
    const [removePair, setRemovePair] = useState(false)

    const nav = useNavigate()

    useEffect(() => {
        if (username) {
            const token    = localStorage.getItem('ub_token')
            const isGuest  = localStorage.getItem('ub_guest') === '1'
            const deviceId = localStorage.getItem('ub_device_id') || undefined

            const newSocket = io(import.meta.env.VITE_APP_WEBSOCKET_URL, {
                transports: ['websocket'],
                auth: {
                    username,
                    token:    token    || undefined,
                    isGuest:  isGuest  || undefined,
                    deviceId: isGuest ? deviceId : undefined,
                }
            });
            setSocket(newSocket);

            // ── Guest limit reached — server rejected the search ──
            newSocket.on('guestLimitReached', () => {
                // Redirect to signup with a "you've used your free call" message
                localStorage.setItem('ub_guest_limit', '1')
                nav('/')
            })

            return () => {
                newSocket.disconnect()
                setSocket(null)
            }
        }

        !username && nav('/')

    }, [username])

    useEffect(() => {
        if (socket && !strangerUsername) {
            socket.emit('startConnection')
            setRemovePair(true)
        }
    }, [socket, strangerUsername])


    useEffect(() => {
        if (socket) {
            socket.on('getStragerData', (data) => {
                setStrangerData(data)
                setStrangerUserId(data.pairedUserId)
                setStrangerUsername(data.strangerUsername)
                setConnectionStatus(true)
            })
            socket.on('strangerLeftTheChat', clearState)
            socket.on('errMakingPair', () => socket.emit('startConnection'))
            socket.on('accountSuspended', (msg) => {
                localStorage.removeItem('ub_token')
                alert(`⛔ ${msg}`)
                window.location.href = '/'
            })

            return() => {
                socket.removeAllListeners('getStragerData')
                socket.removeAllListeners('strangerLeftTheChat')
                socket.removeAllListeners('errMakingPair')
                socket.removeAllListeners('accountSuspended')
            }
        }
    }, [socket])

    function clearState() {
        setStrangerData(null)
        setStrangerUserId('')
        setStrangerUsername(null)
        setConnectionStatus(false)
        remoteVideo.srcObject = null
        setMessage([])

        if (peerConnection.signalingState !== 'closed') peerConnection.close()
        const pcInstance = setPcInstance()
        setPeerConnection(pcInstance)
    }

    useEffect(() => {
        if (updateUser > 0) {
            setDummyStrangerUserId(strangerUserId)
            clearState()


            return () => {
                setDummyStrangerUserId(null)
            }
        }
    }, [updateUser])

    useEffect(() => {
        if (removePair && dummyStrangerUserId) socket.emit('pairedUserLeftTheChat', dummyStrangerUserId)
    }, [removePair, dummyStrangerUserId])

    useEffect(() => {
        if (socket && !strangerUsername) {
            window.addEventListener('beforeunload', () => socket.emit("soloUserLeftTheChat"))
        } else {
            window.addEventListener('beforeunload', () => socket.emit("pairedUserLeftTheChat", strangerUserId))
        }
    }, [socket, strangerUsername])

    return { socket, strangerUserId, strangerUsername, connectionStatus };
}








