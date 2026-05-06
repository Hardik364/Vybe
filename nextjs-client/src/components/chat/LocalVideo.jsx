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
    <div
      className="flex-1 rounded-lg border border-bdr overflow-hidden relative min-h-[160px] shadow-sm transition-all hover:border-accent"
      style={{ background: 'linear-gradient(135deg,var(--bg-surf),var(--bg-elev))', boxShadow: 'var(--sh-sm)' }}
    >
      {/* Placeholder when no video */}
      {!videoEnabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-t4 text-[13px]">
          <div className="w-[60px] h-[60px] rounded-full bg-accent-glow border-2 border-accent flex items-center justify-center text-[26px]">
            🎙️
          </div>
          <span>You — audio only</span>
        </div>
      )}

      <video
        ref={localVideoRef}
        autoPlay playsInline muted
        className="w-full h-full object-cover"
        onClick={() => setChangeCamOverlay(true)}
        style={{ display: videoEnabled ? 'block' : 'none', cursor: 'pointer' }}
      />

      {/* Label */}
      <span
        className="absolute bottom-2.5 left-2.5 text-white text-[11px] font-bold px-3 py-1 rounded-2xl"
        style={{ background: 'oklch(0% 0 0/.72)', backdropFilter: 'blur(8px)' }}
      >
        🎙️ You
      </span>

      {/* Partner-has-video hint */}
      {partnerVideoOn && !videoEnabled && (
        <div
          className="absolute top-2 left-0 right-0 mx-auto w-fit text-[11px] font-bold px-3 py-1 rounded-2xl text-white"
          style={{ background: 'oklch(0% 0 0/.72)' }}
        >
          📷 Partner is on video
        </div>
      )}

      {/* Video toggle button */}
      <button
        onClick={toggleVideo}
        disabled={!strangerUserId || videoLoading}
        className={`absolute bottom-2.5 left-1/2 -translate-x-1/2 px-4 py-[6px] text-[12px] font-semibold rounded-2xl border transition-all whitespace-nowrap z-10 backdrop-blur-[10px] ${
          videoEnabled
            ? 'bg-accent-glow border-accent text-accent'
            : 'text-t2 border-bdr hover:border-accent hover:text-t1'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        style={{ background: videoEnabled ? undefined : 'oklch(0% 0 0/.72)' }}
      >
        {videoLoading ? '⏳' : videoEnabled ? '📷 Camera On' : '📷 Enable Video'}
      </button>
    </div>
  )
}
