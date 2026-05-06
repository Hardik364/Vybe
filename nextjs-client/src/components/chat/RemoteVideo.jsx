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
    <div
      className="flex-1 rounded-lg border border-bdr overflow-hidden relative min-h-[160px] shadow-sm transition-all hover:border-accent"
      style={{ background: 'linear-gradient(135deg,var(--bg-surf),var(--bg-elev))', boxShadow: 'var(--sh-sm)' }}
    >
      {!hasStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-t4 text-[13px]">
          <div className="w-[60px] h-[60px] rounded-full bg-accent-glow border-2 border-accent flex items-center justify-center text-[26px]">
            👥
          </div>
          <span>Waiting for match…</span>
        </div>
      )}
      <video
        ref={remoteVideoRef}
        autoPlay playsInline
        className="w-full h-full object-cover"
        style={{ display: hasStream ? 'block' : 'none' }}
      />
      <span
        className="absolute bottom-2.5 left-2.5 text-white text-[11px] font-bold px-3 py-1 rounded-2xl"
        style={{ background: 'oklch(0% 0 0/.72)', backdropFilter: 'blur(8px)' }}
      >
        👥 Stranger
      </span>
    </div>
  )
}
