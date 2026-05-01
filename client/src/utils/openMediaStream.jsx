// openMediaStream.jsx — opens a media stream with the given constraints
//
// audioOnly = true  → microphone only (no camera permission request).
// audioOnly = false → camera + microphone (used when user explicitly enables video).

export default async function openMediaStream(cameraId, audioOnly = false) {
    const constraints = {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl:  true,
        },
        video: audioOnly
            ? false
            : {
                ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
                width:  { max: 1920 },
                height: { max: 1080 },
              },
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        return stream
    } catch (err) {
        console.error('[openMediaStream] getUserMedia failed:', err.name, err.message)
        throw err
    }
}
