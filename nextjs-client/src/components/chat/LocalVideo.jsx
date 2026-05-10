'use client'
import { useEffect, useState, useRef } from 'react'
import openMediaStream from '@/utils/openMediaStream'

export default function LocalVideo({
  localVideoRef, peerConnection, setChangeCamOverlay, setStream,
  stream, selectedDeviceId, socket, strangerUserId
}) {
  const [videoEnabled,   setVideoEnabled]   = useState(false)
  const [partnerVideoOn, setPartnerVideoOn] = useState(false)
  const [videoLoading,   setVideoLoading]   = useState(false)
  const [micMuted,       setMicMuted]       = useState(false)
  const videoSenderRef = useRef(null)

  // Audio-only stream on mount
  useEffect(() => {
    if (!peerConnection) return
    let inst = null
    async function init() {
      try {
        inst = await openMediaStream(null, true)
        if (localVideoRef.current) localVideoRef.current.srcObject = inst
        setStream(inst)
        setVideoEnabled(false)
      } catch (err) { console.error('[LocalVideo]', err.name, err.message) }
    }
    init()
    return () => { if (inst) inst.getTracks().forEach(t => t.stop()) }
  }, [peerConnection])

  // Partner video events
  useEffect(() => {
    if (!socket) return
    socket.on('partnerVideoOn',  () => setPartnerVideoOn(true))
    socket.on('partnerVideoOff', () => setPartnerVideoOn(false))
    return () => { socket.off('partnerVideoOn'); socket.off('partnerVideoOff') }
  }, [socket])

  useEffect(() => {
    if (!strangerUserId) return
    setPartnerVideoOn(false)
    if (videoEnabled && stream) {
      stream.getVideoTracks().forEach(t => { t.stop(); t.enabled = false })
      if (videoSenderRef.current) {
        try { peerConnection?.removeTrack(videoSenderRef.current) } catch {}
        videoSenderRef.current = null
      }
      setVideoEnabled(false)
    }
  }, [strangerUserId])

  function toggleMic() {
    if (!stream) return
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setMicMuted(m => !m)
  }

  async function toggleVideo() {
    if (!socket || !strangerUserId || !stream) return
    if (videoEnabled) {
      stream.getVideoTracks().forEach(t => { t.stop(); stream.removeTrack(t) })
      if (videoSenderRef.current) {
        try { peerConnection?.removeTrack(videoSenderRef.current) } catch {}
        videoSenderRef.current = null
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      setVideoEnabled(false)
      socket.emit('videoOff', { to: strangerUserId })
    } else {
      setVideoLoading(true)
      try {
        const vs = await openMediaStream(selectedDeviceId, false)
        const vt = vs.getVideoTracks()[0]
        if (!vt) throw new Error('No video track')
        stream.addTrack(vt)
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        if (peerConnection) videoSenderRef.current = peerConnection.addTrack(vt, stream)
        setVideoEnabled(true)
        socket.emit('videoOn', { to: strangerUserId })
      } catch (err) {
        console.error('[LocalVideo]', err.name, err.message)
        if (err.name === 'NotAllowedError') alert('📷 Camera access denied. Please allow it in browser settings.')
      } finally { setVideoLoading(false) }
    }
  }

  return (
    <div className="video-slot">
      {/* Placeholder when no video */}
      {!videoEnabled && (
        <div className="video-ph">
          <div className="video-ph-ico">🎙️</div>
          <span>You — audio only</span>
        </div>
      )}

      <video
        ref={localVideoRef}
        autoPlay playsInline muted
        onClick={() => setChangeCamOverlay(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: videoEnabled ? 'block' : 'none', cursor: 'pointer' }}
      />

      {/* Label */}
      <span className="video-lbl">🎙️ You</span>

      {/* Partner-has-video hint */}
      {partnerVideoOn && !videoEnabled && (
        <div style={{
          position: 'absolute', top: 8, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}>
          <span style={{
            background: 'oklch(0% 0 0/.72)', backdropFilter: 'blur(8px)',
            borderRadius: 'var(--r-full)', padding: '4px 12px',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>
            📷 Partner is on video
          </span>
        </div>
      )}

      {/* Bottom controls: mic + video */}
      <div style={{
        position: 'absolute', bottom: 10,
        left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, zIndex: 10,
      }}>
        {/* Mic mute/unmute — always available once stream exists */}
        <button
          onClick={toggleMic}
          disabled={!stream}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            borderRadius: 'var(--r-full)', border: '1px solid',
            transition: 'all var(--t-fast)', whiteSpace: 'nowrap',
            backdropFilter: 'blur(10px)', cursor: 'pointer',
            background: micMuted ? 'rgba(239,68,68,0.2)' : 'oklch(0% 0 0/.72)',
            borderColor: micMuted ? '#ef4444' : 'var(--border)',
            color: micMuted ? '#ef4444' : 'var(--t2)',
            opacity: !stream ? 0.4 : 1,
          }}
        >
          {micMuted ? '🔇 Muted' : '🎙️ Mic On'}
        </button>

        {/* Video toggle */}
        <button
          onClick={toggleVideo}
          disabled={!strangerUserId || videoLoading}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            borderRadius: 'var(--r-full)', border: '1px solid',
            transition: 'all var(--t-fast)', whiteSpace: 'nowrap',
            backdropFilter: 'blur(10px)', cursor: 'pointer',
            background: videoEnabled ? 'var(--accent-glow)' : 'oklch(0% 0 0/.72)',
            borderColor: videoEnabled ? 'var(--accent)' : 'var(--border)',
            color: videoEnabled ? 'var(--accent)' : 'var(--t2)',
            opacity: (!strangerUserId || videoLoading) ? 0.4 : 1,
          }}
        >
          {videoLoading ? '⏳' : videoEnabled ? '📷 Camera On' : '📷 Enable Video'}
        </button>
      </div>
    </div>
  )
}
