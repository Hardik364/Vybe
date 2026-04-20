export default async function openMediaStream(cameraId) {
    const constraints = {
        'video': {
            ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
            width: { max: 1920 },
            height: { max: 1080 }
        },
        'audio': {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        return stream
    } catch (err) {
        console.error('[openMediaStream] getUserMedia failed:', err.name, err.message)
        throw err
    }
}