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
import AccountDrawer from '@/components/account/AccountDrawer'
import useSocket from '@/hooks/useSocket'
import usePeerConnection from '@/hooks/usePeerConnection'
import { initIceServers } from '@/utils/pcInstance'
import webrtcSignaling from '@/utils/webrtcSignaling'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function ChatPage() {
  const router = useRouter()

  // Read username synchronously so it's never null on first render.
  // This prevents useSocket from firing its !username → router.push('/signup')
  // guard before we've had a chance to check localStorage.
  const [username, setUsername] = useState(() => {
    if (typeof window === 'undefined') return null   // SSR guard
    return localStorage.getItem('ub_username') || null
  })

  useEffect(() => {
    const u = localStorage.getItem('ub_username')
    const t = localStorage.getItem('ub_token')

    // No credentials at all → go to signup
    if (!u && !t) { router.push('/signup'); return }

    // Verify the token is actually valid (not expired / tampered).
    // Guests (isGuest flag) skip server validation — their token is
    // checked by the socket handshake instead.
    const isGuest = localStorage.getItem('ub_guest') === '1'
    if (t && !isGuest) {
      fetch(`${process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
        .then(r => r.json())
        .then(d => {
          if (!d.valid) {
            // Token expired or invalid — clear and send to signup
            localStorage.removeItem('ub_token')
            localStorage.removeItem('ub_username')
            router.push('/signup')
          }
        })
        .catch(() => {
          // Server unreachable — still allow in so user isn't locked out
          // (socket will fail gracefully if server is truly down)
        })
    }

    if (!username) setUsername(u || 'Guest')
    initIceServers()
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  const [message, setMessage]               = useState([])
  const [peerConnection, setPeerConnection] = useState(null)
  const [changeCamOverlay, setChangeCamOverlay] = useState(false)
  const [updateUser, setUpdateUser]         = useState(0)
  const [stream, setStream]                 = useState(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [strangerData, setStrangerData]     = useState(null)
  const [showPostCall, setShowPostCall]     = useState(false)
  const [showKarma, setShowKarma]           = useState(false)
  const [lastStrangerId, setLastStrangerId] = useState(null)
  const [activePrompt, setActivePrompt]     = useState(null)
  const [liveCount, setLiveCount]           = useState(0)
  const [collegeDomain, setCollegeDomain]   = useState('launch')
  const [reportSent, setReportSent]         = useState(false)
  const [showAccount, setShowAccount]       = useState(false)
  const [genderPref, setGenderPref]         = useState(() => {
    if (typeof window === 'undefined') return 'anyone'
    return localStorage.getItem('ub_gender_pref') || 'anyone'
  })

  const localVideoRef  = useRef(null)
  const remoteVideoRef = useRef(null)
  const signalingRef   = useRef(null)

  const { socket, strangerUserId, strangerUsername, connectionStatus, genderStats } = useSocket(
    username, remoteVideoRef, setMessage, updateUser, peerConnection, setPeerConnection, setStrangerData,
    genderPref
  )
  usePeerConnection(setPeerConnection)

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

  useEffect(() => {
    if (!socket) return
    socket.on('showPrompt', p => setActivePrompt(p))
    socket.on('hidePrompt', () => setActivePrompt(null))
    return () => { socket.off('showPrompt'); socket.off('hidePrompt') }
  }, [socket])

  useEffect(() => { if (strangerData?.prompt) setActivePrompt(strangerData.prompt) }, [strangerData])
  useEffect(() => { setActivePrompt(null); setReportSent(false) }, [strangerUserId])

  useEffect(() => {
    if (!socket) return
    socket.on('liveCount', c => setLiveCount(c))
    return () => socket.off('liveCount')
  }, [socket])

  useEffect(() => {
    const token = localStorage.getItem('ub_token')
    if (!token) return
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.valid && d.collegeDomain) setCollegeDomain(d.collegeDomain) })
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
  function doLogout() {
    // Notify partner before socket is torn down, so they don't get stuck
    if (connectionStatus && socket && strangerUserId) {
      socket.emit('pairedUserLeftTheChat', strangerUserId)
    }
    localStorage.clear()
    router.push('/signup')
  }

  function handleGenderPrefChange(pref) {
    setGenderPref(pref)
    localStorage.setItem('ub_gender_pref', pref)
    // Notify server so the next queue entry uses the new preference
    if (socket) socket.emit('updateGenderPref', pref)
  }

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
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <Navbar
        strangerUsername={strangerUsername}
        connectionStatus={connectionStatus}
        promptActive={!!activePrompt}
        onPromptClick={handlePromptToggle}
        liveCount={liveCount}
        onLogout={doLogout}
        onAccount={() => setShowAccount(true)}
        onCommunity={() => { if (!connectionStatus) router.push('/signup') }}
        genderPref={genderPref}
        onGenderPrefChange={handleGenderPrefChange}
        genderStats={genderStats}
      />

      <div className="chat-layout">
        {/* Video panel — 38% */}
        <div className="video-panel">
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
        <div className="msg-panel">
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
            <div className="report-bar">
              <button
                onClick={handleReport}
                disabled={reportSent}
                className={`report-btn${reportSent ? ' reported' : ''}`}
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

      <AccountDrawer
        open={showAccount}
        onClose={() => setShowAccount(false)}
        onLogout={doLogout}
      />
    </div>
  )
}
