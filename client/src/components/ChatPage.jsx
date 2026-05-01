import { useState, useRef, useEffect } from 'react'
import LocalVideo from '../assets/videoCall/localVideo'
import RemoteVideo from '../assets/videoCall/remoteVideo'
import MessagBox from '../assets/messaging/messageBox'
import InputBox from '../assets/messaging/inputBox'
import useSocket from '../hooks/useSocket'
import usePeerConnection from '../hooks/usePeerConnection'
import startWebRtcNegotiation from '../utils/startWebRtcNegotiation'
import ChangeLocalMediaStream from '../assets/videoCall/changeCam'
import Navbar from '../assets/ui/Navbar'
import PromptCard from '../assets/ui/PromptCard'
import PostCallScreen from '../assets/ui/PostCallScreen'
import KarmaModal from '../assets/ui/KarmaModal'
import UpgradeModal from '../assets/ui/UpgradeModal'
import NotifyMe from '../assets/ui/NotifyMe'

export default function ChatPage({ username, setUsername }) {
    // Core state
    const [message, setMessage]               = useState([])
    const [peerConnection, setPeerConnection] = useState(null)
    const [ChangeCamOverly, setChangeCamOverly] = useState(null)
    const [updateUser, setUpdateUser]         = useState(0)
    const [stream, setStream]                 = useState(null)
    const [selectedDeviceId, setSelectedDeviceId] = useState(null)
    const [strangerdata, setStrangerData]     = useState(null)

    // UI state
    const [showPostCall, setShowPostCall]     = useState(false)
    const [showKarma, setShowKarma]           = useState(false)
    const [lastStrangerUserId, setLastStrangerUserId] = useState(null)

    // Phase 2: server-driven prompt
    const [activePrompt, setActivePrompt]     = useState(null)

    // Phase 3: live count
    const [liveCount, setLiveCount]           = useState(0)

    // Notify Me: extract college domain from JWT for subscription key
    const [collegeDomain, setCollegeDomain]   = useState('global')

    // Phase 5: report
    const [reportSent, setReportSent]         = useState(false)

    // Phase 6: tier
    const [showUpgrade, setShowUpgrade]       = useState(false)
    const [userTier,    setUserTier]          = useState('free')

    const localVideo  = useRef(null)
    const remoteVideo = useRef(null)

    const { socket, strangerUserId, strangerUsername, connectionStatus } = useSocket(
        username, remoteVideo.current, setMessage, updateUser, peerConnection, setPeerConnection, setStrangerData
    )

    usePeerConnection(setPeerConnection)
    startWebRtcNegotiation(socket, strangerdata, peerConnection, stream)

    // ── Phase 2: prompt events ───────────────────────────────
    useEffect(() => {
        if (!socket) return
        socket.on('showPrompt', (prompt) => setActivePrompt(prompt))
        socket.on('hidePrompt', ()         => setActivePrompt(null))
        return () => {
            socket.off('showPrompt')
            socket.off('hidePrompt')
        }
    }, [socket])

    // Auto-show prompt sent with the match payload
    useEffect(() => {
        if (strangerdata?.prompt) setActivePrompt(strangerdata.prompt)
    }, [strangerdata])

    // Clear prompt + report state when partner changes
    useEffect(() => {
        setActivePrompt(null)
        setReportSent(false)
    }, [strangerUserId])

    // ── Phase 3: live count ──────────────────────────────────
    useEffect(() => {
        if (!socket) return
        socket.on('liveCount', (count) => setLiveCount(count))
        return () => socket.off('liveCount')
    }, [socket])

    // ── Phase 6: load tier ───────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('rt_token')
        if (!token) return
        fetch(`${import.meta.env.VITE_APP_WEBSOCKET_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(d => {
                if (d.valid) {
                    if (d.tier) setUserTier(d.tier)
                    if (d.collegeDomain) setCollegeDomain(d.collegeDomain)
                }
            })
            .catch(() => {})
    }, [])

    // ── Prompt handlers ──────────────────────────────────────
    function handlePromptToggle() {
        if (!socket || !strangerUserId) return
        if (activePrompt) {
            socket.emit('dismissPrompt', { to: strangerUserId })
        } else {
            socket.emit('requestPrompt', { to: strangerUserId })
        }
    }

    function handleNextPrompt() {
        if (!socket || !strangerUserId) return
        socket.emit('nextPrompt', { to: strangerUserId, excludeId: activePrompt?.id })
    }

    function handleDismissPrompt() {
        if (!socket || !strangerUserId) return
        socket.emit('dismissPrompt', { to: strangerUserId })
    }

    // ── New user / post-call flow ────────────────────────────
    function handleNewUser() {
        if (connectionStatus) {
            setLastStrangerUserId(strangerUserId)
            setShowPostCall(true)
        } else {
            setUpdateUser(prev => prev + 1)
        }
    }

    function handleConnect() {
        // PostCallScreen handles the socket emit — just update local UI
        setShowPostCall(false)
        setShowKarma(true)
    }

    function handleMoveOn() {
        setShowPostCall(false)
        setShowKarma(true)
    }

    function handleReport() {
        if (!socket || !strangerUserId || reportSent) return
        socket.emit('reportUser', { to: strangerUserId, reason: 'inappropriate behaviour' })
        setReportSent(true)
    }

    function handleKarmaRate() {
        setShowKarma(false)
        setActivePrompt(null)
        setLastStrangerUserId(null)
        setUpdateUser(prev => prev + 1)
    }

    return (
        <div id="appShell">
            <Navbar
                strangerUsername={strangerUsername}
                connectionStatus={connectionStatus}
                promptActive={!!activePrompt}
                onPromptClick={handlePromptToggle}
                liveCount={liveCount}
                setUsername={setUsername}
                tier={userTier}
                onUpgradeClick={() => setShowUpgrade(true)}
            />

            <div id="chatPage">
                {/* Video panel */}
                <div id="videoCall">
                    <ChangeLocalMediaStream
                        peerConnection={peerConnection}
                        localVideo={localVideo.current}
                        ChangeCamOverly={ChangeCamOverly}
                        setChangeCamOverly={setChangeCamOverly}
                        selectedDeviceId={selectedDeviceId}
                        setSelectedDeviceId={setSelectedDeviceId}
                        setStream={setStream}
                    />
                    <LocalVideo
                        localVideo={localVideo}
                        peerConnection={peerConnection}
                        setChangeCamOverly={setChangeCamOverly}
                        setStream={setStream}
                        stream={stream}
                        selectedDeviceId={selectedDeviceId}
                        socket={socket}
                        strangerUserId={strangerUserId}
                    />
                    <RemoteVideo
                        remoteVideo={remoteVideo}
                        peerConnection={peerConnection}
                        setChangeCamOverly={setChangeCamOverly}
                    />
                </div>

                {/* Messaging panel */}
                <div id="messaging">
                    {activePrompt && (
                        <PromptCard
                            prompt={activePrompt}
                            onNext={handleNextPrompt}
                            onClose={handleDismissPrompt}
                        />
                    )}
                    <MessagBox
                        message={message}
                        username={username}
                        socket={socket}
                        setMessage={setMessage}
                        strangerUsername={strangerUsername}
                        strangerUserId={strangerUserId}
                        connectionStatus={connectionStatus}
                    />
                    {connectionStatus && (
                        <div id="report-bar">
                            <button
                                id="reportBtn"
                                onClick={handleReport}
                                disabled={reportSent}
                                title="Report this user for inappropriate behaviour"
                            >
                                {reportSent ? '✓ Reported' : '🚩 Report'}
                            </button>
                        </div>
                    )}

                    {/* Notify Me — only when nobody is waiting and not in a call */}
                    {!connectionStatus && liveCount === 0 && (
                        <NotifyMe collegeDomain={collegeDomain} />
                    )}

                    <InputBox
                        socket={socket}
                        setMessage={setMessage}
                        setUsername={setUsername}
                        onNewUser={handleNewUser}
                        strangerUserId={strangerUserId}
                        username={username}
                        strangerUsername={strangerUsername}
                    />
                </div>
            </div>

            {showPostCall && (
                <PostCallScreen
                    strangerUsername={strangerUsername}
                    strangerUserId={lastStrangerUserId || strangerUserId}
                    socket={socket}
                    onConnect={handleConnect}
                    onMoveOn={handleMoveOn}
                />
            )}

            {showKarma && (
                <KarmaModal
                    strangerUsername={strangerUsername}
                    strangerUserId={lastStrangerUserId || strangerUserId}
                    socket={socket}
                    onRate={handleKarmaRate}
                />
            )}

            {showUpgrade && (
                <UpgradeModal
                    currentTier={userTier}
                    onClose={() => setShowUpgrade(false)}
                    onTierChange={(tier) => { setUserTier(tier); setShowUpgrade(false) }}
                />
            )}
        </div>
    )
}
