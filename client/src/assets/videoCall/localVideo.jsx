import React, { useEffect, useState } from "react"
import openMediaStream from "../../utils/openMediaStream"

export default function LocalVideo({
    localVideo, peerConnection, setChangeCamOverly, setStream, stream,
    selectedDeviceId, socket, strangerUserId
}) {
    const [videoEnabled, setVideoEnabled]       = useState(false)
    const [partnerWantsVideo, setPartnerWantsVideo] = useState(false)

    // ── Open media stream: audio-only by default ─────────────
    useEffect(() => {
        if (peerConnection) {
            let streamInstance = null
            async function handelMediaStream() {
                try {
                    streamInstance = await openMediaStream(selectedDeviceId)

                    // Voice-first: disable video track immediately
                    streamInstance.getVideoTracks().forEach(t => { t.enabled = false })

                    if (localVideo.current) {
                        localVideo.current.srcObject = streamInstance
                    }
                    setStream(streamInstance)
                    setVideoEnabled(false)
                } catch (err) {
                    console.error('[LocalVideo] Failed to open media stream:', err.name, err.message)
                }
            }
            if (localVideo.current) handelMediaStream()

            return () => {
                if (streamInstance) {
                    streamInstance.getTracks().forEach(t => t.stop())
                    console.log("stop stream")
                }
            }
        }
    }, [peerConnection])

    // ── Listen for partner video consent events ──────────────
    useEffect(() => {
        if (!socket) return
        socket.on('partnerWantsVideo',   () => setPartnerWantsVideo(true))
        socket.on('partnerTurnedOffVideo', () => {
            setPartnerWantsVideo(false)
            // If partner turns off, we also turn off our display
        })
        socket.on('videoBothConsented',  () => {
            // Both consented — enable video track
            if (stream) {
                stream.getVideoTracks().forEach(t => { t.enabled = true })
                setVideoEnabled(true)
            }
        })
        socket.on('videoDisabled', () => {
            if (stream) {
                stream.getVideoTracks().forEach(t => { t.enabled = false })
                setVideoEnabled(false)
            }
        })
        return () => {
            socket.off('partnerWantsVideo')
            socket.off('partnerTurnedOffVideo')
            socket.off('videoBothConsented')
            socket.off('videoDisabled')
        }
    }, [socket, stream])

    // Reset video consent when partner changes
    useEffect(() => {
        setVideoEnabled(false)
        setPartnerWantsVideo(false)
        if (stream) stream.getVideoTracks().forEach(t => { t.enabled = false })
    }, [strangerUserId])

    function handleToggleVideo() {
        if (!socket || !strangerUserId) return
        if (videoEnabled) {
            // Turn off
            if (stream) stream.getVideoTracks().forEach(t => { t.enabled = false })
            setVideoEnabled(false)
            socket.emit('videoConsentOff', { to: strangerUserId })
        } else {
            // Request consent
            socket.emit('videoConsentOn', { to: strangerUserId })
            // Will be enabled when 'videoBothConsented' fires
        }
    }

    return (
        <div id="localVideoWrap">
            <video
                id="localVideo"
                ref={localVideo}
                onClick={() => setChangeCamOverly(true)}
                autoPlay playsInline controls={false} muted
            />
            <button
                id="videoConsentBtn"
                className={[
                    videoEnabled        ? 'video-on'      : 'video-off',
                    partnerWantsVideo && !videoEnabled ? 'partner-ready' : '',
                ].join(' ').trim()}
                onClick={handleToggleVideo}
                title={videoEnabled ? 'Turn off camera' : 'Enable camera (both must agree)'}
                disabled={!strangerUserId}
            >
                {videoEnabled
                    ? '📷 Camera On'
                    : partnerWantsVideo
                        ? '✅ They want video — click to go live!'
                        : '📷 Enable Video'}
            </button>
        </div>
    )
}
