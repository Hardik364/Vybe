// localVideo.jsx — local camera/mic controls
//
// Video is audio-first: camera starts OFF.
// Each user independently controls their own camera.
// Pressing "Enable Video" turns YOUR camera on immediately —
// no waiting for the other person.

import { useEffect, useState } from "react"
import openMediaStream from "../../utils/openMediaStream"

export default function LocalVideo({
    localVideo, peerConnection, setChangeCamOverly, setStream, stream,
    selectedDeviceId, socket, strangerUserId
}) {
    const [videoEnabled,   setVideoEnabled]   = useState(false)
    const [partnerVideoOn, setPartnerVideoOn] = useState(false) // partner's camera status

    // ── Open media stream: audio-only by default ─────────────
    useEffect(() => {
        if (!peerConnection) return
        let streamInstance = null

        async function initStream() {
            try {
                streamInstance = await openMediaStream(selectedDeviceId)
                // Voice-first: disable video track on start
                streamInstance.getVideoTracks().forEach(t => { t.enabled = false })
                if (localVideo.current) localVideo.current.srcObject = streamInstance
                setStream(streamInstance)
                setVideoEnabled(false)
            } catch (err) {
                console.error('[LocalVideo] Media stream error:', err.name, err.message)
            }
        }

        if (localVideo.current) initStream()

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

    // Reset when partner changes (new match)
    useEffect(() => {
        setVideoEnabled(false)
        setPartnerVideoOn(false)
        if (stream) stream.getVideoTracks().forEach(t => { t.enabled = false })
    }, [strangerUserId])

    // ── Toggle your own camera ────────────────────────────────
    function handleToggleVideo() {
        if (!socket || !strangerUserId || !stream) return

        const next = !videoEnabled
        stream.getVideoTracks().forEach(t => { t.enabled = next })
        setVideoEnabled(next)
        socket.emit(next ? 'videoOn' : 'videoOff', { to: strangerUserId })
    }

    return (
        <div id="localVideoWrap">
            <video
                id="localVideo"
                ref={localVideo}
                onClick={() => setChangeCamOverly(true)}
                autoPlay playsInline controls={false} muted
            />

            {/* Partner video indicator — subtle badge when they're on camera */}
            {partnerVideoOn && !videoEnabled && (
                <div id="partner-video-badge">📷 Partner is on video</div>
            )}

            <button
                id="videoConsentBtn"
                className={videoEnabled ? 'video-on' : 'video-off'}
                onClick={handleToggleVideo}
                disabled={!strangerUserId}
                title={videoEnabled ? 'Turn off your camera' : 'Turn on your camera'}
            >
                {videoEnabled ? '📷 Camera On' : '📷 Enable Video'}
            </button>
        </div>
    )
}
