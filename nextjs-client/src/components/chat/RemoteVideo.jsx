'use client'
import { useEffect, useState, useCallback } from 'react'

export default function RemoteVideo({ remoteVideoRef, peerConnection, socket, strangerUserId }) {
  const [hasStream,      setHasStream]      = useState(false)
  // tracks whether the partner's video track is active (camera on vs camera off)
  const [remoteVideoOn,  setRemoteVideoOn]  = useState(false)

  // ── Clear everything when peer connection is replaced ─────────
  // This fires after every "Next" so the frozen frame never persists
  useEffect(() => {
    setHasStream(false)
    setRemoteVideoOn(false)
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
  }, [peerConnection])

  // ── Also clear when stranger leaves (strangerUserId → null) ──
  useEffect(() => {
    if (!strangerUserId) {
      setHasStream(false)
      setRemoteVideoOn(false)
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    }
  }, [strangerUserId])

  // ── Handle incoming tracks ────────────────────────────────────
  useEffect(() => {
    if (!peerConnection) return

    peerConnection.ontrack = (event) => {
      if (!remoteVideoRef.current) return
      remoteVideoRef.current.srcObject = event.streams[0]
      setHasStream(true)

      // Watch the video track specifically — when the partner disables their
      // camera the track is stopped/removed, which fires `ended`.
      // We do NOT use `onmute` because that fires on brief network hiccups too.
      const track = event.track
      if (track.kind === 'video') {
        setRemoteVideoOn(true)
        track.onended = () => setRemoteVideoOn(false)
      }
    }

    // ── ICE disconnect = partner closed their connection ─────────
    // Fires when User1 clicks "Next" — User2's frozen frame clears immediately
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        setHasStream(false)
        setRemoteVideoOn(false)
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      }
    }

    return () => {
      peerConnection.ontrack = null
      peerConnection.oniceconnectionstatechange = null
    }
  }, [peerConnection])

  // ── Socket: partner toggled their camera on/off ───────────────
  // Primary signal for camera toggle (more reliable than track events)
  useEffect(() => {
    if (!socket) return
    const on  = () => setRemoteVideoOn(true)
    const off = () => {
      setRemoteVideoOn(false)
      // Explicitly clear the video src so the frozen last-frame disappears
      if (remoteVideoRef.current) {
        remoteVideoRef.current.pause()
        remoteVideoRef.current.srcObject = remoteVideoRef.current.srcObject  // keep audio
      }
    }
    socket.on('partnerVideoOn',  on)
    socket.on('partnerVideoOff', off)
    return () => {
      socket.off('partnerVideoOn',  on)
      socket.off('partnerVideoOff', off)
    }
  }, [socket])

  // ── Auto-resume if browser throttles/pauses the element ──────
  useEffect(() => {
    const video = remoteVideoRef.current
    if (!video) return
    const resume = () => video.play().catch(() => {})
    video.addEventListener('pause',   resume)
    video.addEventListener('stalled', resume)
    video.addEventListener('suspend', resume)
    return () => {
      video.removeEventListener('pause',   resume)
      video.removeEventListener('stalled', resume)
      video.removeEventListener('suspend', resume)
    }
  }, [])

  // ── Restore on tab focus ──────────────────────────────────────
  useEffect(() => {
    const video = remoteVideoRef.current
    function onVisible() {
      if (document.hidden || !video) return
      if (video.paused) video.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Decide what to display
  const showVideo       = hasStream && remoteVideoOn
  const showAudioOnly   = hasStream && !remoteVideoOn   // connected but camera off
  const showWaiting     = !hasStream                    // not yet matched

  return (
    <div className="video-slot">
      {/* Placeholder — shown when waiting OR when partner disabled camera */}
      {!showVideo && (
        <div className="video-ph">
          <div className="video-ph-ico">
            {showAudioOnly ? '🎙️' : '👥'}
          </div>
          <span>
            {showAudioOnly ? 'Stranger — audio only' : 'Waiting for match…'}
          </span>
        </div>
      )}

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: showVideo ? 'block' : 'none',
        }}
      />
      <span className="video-lbl">👥 Stranger</span>
    </div>
  )
}
