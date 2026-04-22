import React, { useEffect, useState, useRef } from "react"
import openMediaStream from "../../utils/openMediaStream"

const CONSENT_TIMEOUT_MS = 10000  // 10 seconds — reset if partner doesn't respond

export default function LocalVideo({
    localVideo, peerConnection, setChangeCamOverly, setStream, stream,
    selectedDeviceId, socket, strangerUserId
}) {
    const [videoEnabled,      setVideoEnabled]      = useState(false)
    const [partnerWantsVideo, setPartnerWantsVideo] = useState(false)
    const [consentPending,    setConsentPending]    = useState(false) // waiting for partner
    const consentTimerRef = useRef(null)

    // ── Open media stream: audio-only by default ─────────────
    useEffect(() => {
        if (peerConnection) {
            let streamInstance = null
            async function handelMediaStream() {
                try {
                    streamInstance = await openMediaStream(selectedDeviceId)
                    // Voice-first: disable video track immediately
                    streamInstance.getVideoTracks().forEach(t => { t.enabled = false })
                    if (localVideo.current) localVideo.current.srcObject = streamInstance
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
                }
            }
        }
    }, [peerConnection])

    // ── Listen for partner video consent events ──────────────
    useEffect(() => {
        if (!socket) return

        socket.on('partnerWantsVideo', () => setPartnerWantsVideo(true))

        socket.on('partnerTurnedOffVideo', () => {
            setPartnerWantsVideo(false)
        })

        socket.on('videoBothConsented', () => {
            // Both consented — enable video track
            clearConsentTimer()
            setConsentPending(false)
            if (stream) {
                stream.getVideoTracks().forEach(t => { t.enabled = true })
                setVideoEnabled(true)
            }
        })

        socket.on('videoDisabled', () => {
            clearConsentTimer()
            setConsentPending(false)
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
        clearConsentTimer()
        setVideoEnabled(false)
        setPartnerWantsVideo(false)
        setConsentPending(false)
        if (stream) stream.getVideoTracks().forEach(t => { t.enabled = false })
    }, [strangerUserId])

    function clearConsentTimer() {
        if (consentTimerRef.current) {
            clearTimeout(consentTimerRef.current)
            consentTimerRef.current = null
        }
    }

    function handleToggleVideo() {
        if (!socket || !strangerUserId) return

        if (videoEnabled) {
            // Turn off
            if (stream) stream.getVideoTracks().forEach(t => { t.enabled = false })
            setVideoEnabled(false)
            setConsentPending(false)
            clearConsentTimer()
            socket.emit('videoConsentOff', { to: strangerUserId })
        } else if (consentPending) {
            // Cancel pending request
            setConsentPending(false)
            clearConsentTimer()
            socket.emit('videoConsentOff', { to: strangerUserId })
        } else {
            // Request consent — start 10s timeout
            setConsentPending(true)
            socket.emit('videoConsentOn', { to: strangerUserId })
            consentTimerRef.current = setTimeout(() => {
                // Partner didn't respond in time — reset silently
                setConsentPending(false)
                consentTimerRef.current = null
            }, CONSENT_TIMEOUT_MS)
        }
    }

    // Cleanup timer on unmount
    useEffect(() => () => clearConsentTimer(), [])

    const btnLabel = (() => {
        if (videoEnabled)      return '📷 Camera On'
        if (consentPending)    return '⏳ Waiting… (tap to cancel)'
        if (partnerWantsVideo) return '✅ They want video — click to go live!'
        return '📷 Enable Video'
    })()

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
                    videoEnabled                        ? 'video-on'      : 'video-off',
                    consentPending                      ? 'consent-pending' : '',
                    partnerWantsVideo && !videoEnabled  ? 'partner-ready' : '',
                ].join(' ').trim()}
                onClick={handleToggleVideo}
                title={videoEnabled ? 'Turn off camera' : 'Enable camera (both must agree)'}
                disabled={!strangerUserId}
            >
                {btnLabel}
            </button>
        </div>
    )
}
