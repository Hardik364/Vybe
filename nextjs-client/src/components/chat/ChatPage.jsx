'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from './Navbar'
import LocalVideo from './LocalVideo'
import RemoteVideo from './RemoteVideo'
import ChangeCam from './ChangeCam'
import MessageBox from './MessageBox'
import InputBar from './InputBar'
import PromptCard from './PromptCard'
import NotifyMe from '@/components/NotifyMe'
import PostCallScreen from '@/components/modals/PostCallScreen'
import KarmaModal from '@/components/modals/KarmaModal'
import UpgradeModal from '@/components/modals/UpgradeModal'
import useSocket from '@/hooks/useSocket'
import usePeerConnection from '@/hooks/usePeerConnection'
import { initIceServers } from '@/utils/pcInstance'
import webrtcSignaling from '@/utils/webrtcSignaling'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function ChatPage() {
  const router = useRouter()

  // Auth
  const [username, setUsername] = useState(null)
  useEffect(() => {
    const u = localStorage.getItem('ub_username')
    const t = localStorage.getItem('ub_token')
    if (!u && !t) { router.push('/signup'); return }
    setUsername(u || 'Guest')
    initIceServers()
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  // Core state
  const [message, setMessage]               = useState([])
  const [peerConnection, setPeerConnection] = useState(null)
  const [changeCamOverlay, setChangeCamOverlay] = useState(false)
  const [updateUser, setUpdateUser]         = useState(0)
  const [stream, setStream]                 = useState(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [strangerData, setStrangerData]     = useState(null)

  // UI
  const [showPostCall, setShowPostCall]     = useState(false)
  const [showKarma, setShowKarma]           = useState(false)
  const [lastStrangerId, setLastStrangerId] = useState(null)
  const [activePrompt, setActivePrompt]     = useState(null)
  const [liveCount, setLiveCount]           = useState(0)
  const [collegeDomain, setCollegeDomain]   = useState('global')
  const [reportSent, setReportSent]         = useState(false)
  const [showUpgrade, setShowUpgrade]       = useState(false)
  const [userTier, setUserTier]             = useState('free')

  const localVideoRef  = useRef(null)
  const remoteVideoRef = useRef(null)
  const signalingRef   = useRef(null)

  const { socket, strangerUserId, strangerUsername, connectionStatus } = useSocket(
    username, remoteVideoRef, setMessage, updateUser, peerConnection, setPeerConnection, setStrangerData
  )
  usePeerConnection(setPeerConnection)

  // WebRTC negotiation
  useEffect(() => {
    if (!strangerData || !peerConnection || !stream || !socket) return
    signalingRef.current = webrtcSignaling(socket, peerConnection, strangerData)
    const { sendOffer, sendCandidate, handleNegotiation } = signalingRef.current
    try {
      for (const track of stream.getTracks()) peerConnection.addTrack(track, stream)
      peerConnection.onnegotiationneeded = sendOffer
      peerConnection.onicecandidate = sendCandidate
      socket.on('message', handleNegotiation)
    } catch (err) { console.error(err) }
    return () => {
      if (peerConnection.signalingState !== 'closed')
        peerConnection.getSenders().forEach(s => peerConnection.removeTrack(s))
      socket.removeAllListeners('message')
    }
  }, [stream, strangerData])

  // Prompt events
  useEffect(() => {
    if (!socket) return
    socket.on('showPrompt', p => setActivePrompt(p))
    socket.on('hidePrompt', () => setActivePrompt(null))
    return () => { socket.off('showPrompt'); socket.off('hidePrompt') }
  }, [socket])

  useEffect(() => { if (strangerData?.prompt) setActivePrompt(strangerData.prompt) }, [strangerData])
  useEffect(() => { setActivePrompt(null); setReportSent(false) }, [strangerUserId])

  // Live count
  useEffect(() => {
    if (!socket) return
    socket.on('liveCount', c => setLiveCount(c))
    return () => socket.off('liveCount')
  }, [socket])

  // Load tier
  useEffect(() => {
    const token = localStorage.getItem('ub_token')
    if (!token) return
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.valid) { if (d.tier) setUserTier(d.tier); if (d.collegeDomain) setCollegeDomain(d.collegeDomain) } })
      .catch(() => {})
  }, [])

  function handlePromptToggle() {
    if (!socket || !strangerUserId) return
    if (activePrompt) socket.emit('dismissPrompt', { to: strangerUserId })
    else socket.emit('requestPrompt', { to: strangerUserId, excludeId: null })
  }
  function handleNextPrompt() {
    if (!socket || !strangerUserId) return
    socket.emit('nextPrompt', { to: strangerUserId, excludeId: activePrompt?.id })
  }
  function handleDismissPrompt() {
    if (!socket || !strangerUserId) return
    socket.emit('dismissPrompt', { to: strangerUserId })
  }
  function handleNewUser() {
    if (connectionStatus) { setLastStrangerId(strangerUserId); setShowPostCall(true) }
    else setUpdateUser(p => p + 1)
  }
  function handleConnect() { setShowPostCall(false); setShowKarma(true) }
  function handleMoveOn()  { setShowPostCall(false); setShowKarma(true) }
  function handleKarmaRate() {
    setShowKarma(false); setActivePrompt(null); setLastStrangerId(null)
    setUpdateUser(p => p + 1)
  }
  function handleReport() {
    if (!socket || !strangerUserId || reportSent) return
    socket.emit('reportUser', { to: strangerUserId, reason: 'inappropriate behaviour' })
    setReportSent(true)
  }

  if (!username) return null

  return (
    <div className="absolute inset-0 flex flex-col bg-base">
      <Navbar
        strangerUsername={strangerUsername}
        connectionStatus={connectionStatus}
        promptActive={!!activePrompt}
        onPromptClick={handlePromptToggle}
        liveCount={liveCount}
        onLogout={() => { localStorage.clear(); router.push('/signup') }}
        tier={userTier}
        onUpgradeClick={() => setShowUpgrade(true)}
        onAccount={() => router.push('/account')}
        onCommunity={() => router.push('/community')}
      />

      <div
        className="flex flex-1 overflow-hidden p-3 gap-2.5"
        style={{
          '--light-chat-bg': 'linear-gradient(135deg,oklch(94% 0.015 280 / 0.5),oklch(94% 0.012 160 / 0.3))',
        }}
      >
        {/* Video panel — 38% */}
        <div className="flex flex-col gap-2 shrink-0 overflow-hidden" style={{ width: '38%', minWidth: 260 }}>
          <ChangeCam
            peerConnection={peerConnection}
            localVideoRef={localVideoRef}
            show={changeCamOverlay}
            setShow={setChangeCamOverlay}
            selectedDeviceId={selectedDeviceId}
            setSelectedDeviceId={setSelectedDeviceId}
            setStream={setStream}
          />
          <LocalVideo
            localVideoRef={localVideoRef}
            peerConnection={peerConnection}
            setChangeCamOverlay={setChangeCamOverlay}
            setStream={setStream}
            stream={stream}
            selectedDeviceId={selectedDeviceId}
            socket={socket}
            strangerUserId={strangerUserId}
          />
          <RemoteVideo
            remoteVideoRef={remoteVideoRef}
            peerConnection={peerConnection}
          />
        </div>

        {/* Message panel */}
        <div
          className="flex-1 flex flex-col rounded-lg border border-bdr overflow-hidden min-w-0 shadow-sm bg-surf"
          style={{
            boxShadow: 'var(--sh-sm)',
          }}
        >
          {activePrompt && (
            <PromptCard
              prompt={activePrompt}
              onNext={handleNextPrompt}
              onClose={handleDismissPrompt}
            />
          )}

          <MessageBox
            messages={message}
            username={username}
            socket={socket}
            setMessage={setMessage}
            strangerUsername={strangerUsername}
            strangerUserId={strangerUserId}
            connectionStatus={connectionStatus}
          />

          {connectionStatus && (
            <div className="px-3 py-1 flex justify-end shrink-0">
              <button
                onClick={handleReport}
                disabled={reportSent}
                className={`text-[12px] px-2.5 py-1 rounded-2xl border transition-all ${
                  reportSent
                    ? 'text-green border-transparent cursor-default'
                    : 'text-t4 border-transparent hover:border-red hover:text-red hover:bg-red-sub'
                }`}
              >
                {reportSent ? '✅ Reported' : '🚩 Report'}
              </button>
            </div>
          )}

          {!connectionStatus && liveCount === 0 && <NotifyMe collegeDomain={collegeDomain} />}

          <InputBar
            socket={socket}
            setMessage={setMessage}
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
          strangerUserId={lastStrangerId || strangerUserId}
          socket={socket}
          onConnect={handleConnect}
          onMoveOn={handleMoveOn}
        />
      )}
      {showKarma && (
        <KarmaModal
          strangerUsername={strangerUsername}
          strangerUserId={lastStrangerId || strangerUserId}
          socket={socket}
          onRate={handleKarmaRate}
        />
      )}
      {showUpgrade && (
        <UpgradeModal
          currentTier={userTier}
          onClose={() => setShowUpgrade(false)}
          onTierChange={t => { setUserTier(t); setShowUpgrade(false) }}
        />
      )}
    </div>
  )
}
