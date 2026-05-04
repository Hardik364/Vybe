// localVideo.jsx — local camera/mic controls
//
// Voice-first: microphone starts immediately, camera stays OFF.
// Pressing "Enable Video" requests camera permission and adds the
// video track to the existing peer connection (triggers renegotiation).
// This means NO camera LED until the user explicitly opts in.

import { useEffect, useState, useRef } from "react"
import openMediaStream from "../../utils/openMediaStream"

export default function LocalVideo({
    localVideo, peerConnection, setChangeCamOverly, setStream, stream,
    selectedDeviceId, socket, strangerUserId
}) {
    const [videoEnabled,   setVideoEnabled]   = useState(false)
    const [partnerVideoOn, setPartnerVideoOn] = useState(false)
    const [videoLoading,   setVideoLoading]   = useState(false)

    const videoSenderRef = useRef(null)

    // ── Open audio-only stream on mount ─────────────────────────
    useEffect(() => {
        if (!peerConnection) return
        let streamInstance = null

        async function initStream() {
            try {
                streamInstance = await openMediaStream(null, true)
                if (localVideo.current) localVideo.current.srcObject = streamInstance
                setStream(streamInstance)
                setVideoEnabled(false)
            } catch (err) {
                console.error('[LocalVideo] Audio stream error:', err.name, err.message)
            }
        }

        initStream()

        return () => {
            if (streamInstance) streamInstance.getTracks().forEach(t => t.stop())
        }
    }, [peerConnection])

    // ── Partner video status events ───────────────────────────
    useEffect(() => {
        if (!socket) return
        socket.on('partnerVideoOn',  () => setPartnerVideoOn(true))
        socket.on('partnerVideoOff', () => setPartnerVideoOn(false))
        return () => {
            socket.off('partnerVideoOn')
            socket.off('partnerVideoOff')
        }
    }, [socket])

    // Reset video when partner changes (new match)
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

    // ── Toggle your own camera ────────────────────────────────
    async function handleToggleVideo() {
        if (!socket || !strangerUserId || !stream) return

        if (videoEnabled) {
            stream.getVideoTracks().forEach(t => { t.stop(); stream.removeTrack(t) })
            if (videoSenderRef.current) {
                try { peerConnection?.removeTrack(videoSenderRef.current) } catch {}
                videoSenderRef.current = null
            }
            if (localVideo.current) localVideo.current.srcObject = stream
            setVideoEnabled(false)
            socket.emit('videoOff', { to: strangerUserId })
        } else {
            setVideoLoading(true)
            try {
                const videoStream = await openMediaStream(selectedDeviceId, false)
                const videoTrack  = videoStream.getVideoTracks()[0]
                if (!videoTrack) throw new Error('No video track obtained')

                stream.addTrack(videoTrack)
                if (localVideo.current) localVideo.current.srcObject = stream

                if (peerConnection) {
                    videoSenderRef.current = peerConnection.addTrack(videoTrack, stream)
                }

                setVideoEnabled(true)
                socket.emit('videoOn', { to: strangerUserId })
            } catch (err) {
                console.error('[LocalVideo] Enable video failed:', err.name, err.message)
                if (err.name === 'NotAllowedError') {
                    alert('📷 Camera access denied. Please allow camera access in your browser settings.')
                }
            } finally {
                setVideoLoading(false)
            }
        }
    }

    return (
        <div id="localVideoWrap">
            <span className="video-label">🎙️ You</span>

            <video
                id="localVideo"
                ref={localVideo}
                onClick={() => setChangeCamOverly(true)}
                autoPlay playsInline controls={false} muted
            />

            {/* Partner video indicator */}
            {partnerVideoOn && !videoEnabled && (
                <div id="partner-video-badge">📷 Partner is on video</div>
            )}

            <button
                id="videoConsentBtn"
                className={videoEnabled ? 'video-on' : 'video-off'}
                onClick={handleToggleVideo}
                disabled={!strangerUserId || videoLoading}
                title={videoEnabled ? 'Turn off your camera' : 'Turn on your camera'}
            >
                {videoLoading
                    ? '⏳ Starting...'
                    : videoEnabled
                        ? '📷 Camera On'
                        : '📷 Enable Video'
                }
            </button>
        </div>
    )
}
