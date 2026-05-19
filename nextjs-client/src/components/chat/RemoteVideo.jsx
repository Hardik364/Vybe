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
    // Cleanup: null the handler so it doesn't fire on the stale PC instance.
    return () => { peerConnection.ontrack = null }
  }, [peerConnection])

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
        autoPlay playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: hasStream ? 'block' : 'none' }}
      />
      <span className="video-lbl">👥 Stranger</span>
    </div>
  )
}
