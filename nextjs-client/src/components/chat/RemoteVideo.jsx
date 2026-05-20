'use client'
import { useEffect, useState } from 'react'

export default function RemoteVideo({ remoteVideoRef, peerConnection }) {
  const [hasStream, setHasStream] = useState(false)

  // Reset the placeholder whenever the peer connection is replaced
  // (which happens after every "Next" — clearState() creates a new PC).
  useEffect(() => {
    setHasStream(false)
  }, [peerConnection])

  useEffect(() => {
    if (!peerConnection) return
    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
        setHasStream(true)
      }
    }
    return () => { peerConnection.ontrack = null }
  }, [peerConnection])

  // ── Auto-resume if the browser pauses the video element ──────
  // Background-tab throttling or a brief network hiccup can cause the
  // <video> element to pause.  Resume it immediately so the remote
  // stream keeps playing for the local user.
  useEffect(() => {
    const video = remoteVideoRef.current
    if (!video) return

    function resume() {
      video.play().catch(() => {})
    }

    // Browser paused the element (e.g. tab hidden, low power mode)
    video.addEventListener('pause',   resume)
    // Stream stalled — no new data arrived for a moment
    video.addEventListener('stalled', resume)
    // Media playback was suspended by the browser
    video.addEventListener('suspend', resume)

    return () => {
      video.removeEventListener('pause',   resume)
      video.removeEventListener('stalled', resume)
      video.removeEventListener('suspend', resume)
    }
  }, [])

  // ── Restore playback when the user comes back to the tab ─────
  useEffect(() => {
    const video = remoteVideoRef.current
    function onVisibilityChange() {
      if (document.hidden || !video) return
      // If the element was paused while the tab was hidden, un-pause it
      if (video.paused) video.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return (
    <div className="video-slot">
      {!hasStream && (
        <div className="video-ph">
          <div className="video-ph-ico">👥</div>
          <span>Waiting for match…</span>
        </div>
      )}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: hasStream ? 'block' : 'none' }}
      />
      <span className="video-lbl">👥 Stranger</span>
    </div>
  )
}
