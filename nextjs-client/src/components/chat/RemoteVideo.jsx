'use client'
import { useEffect, useState } from 'react'

export default function RemoteVideo({ remoteVideoRef, peerConnection }) {
  const [hasStream, setHasStream] = useState(false)

  useEffect(() => {
    if (!peerConnection) return
    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
        setHasStream(true)
      }
    }
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
