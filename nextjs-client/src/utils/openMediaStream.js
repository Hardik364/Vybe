export default async function openMediaStream(cameraId, audioOnly = false) {
  const constraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: audioOnly
      ? false
      : { ...(cameraId ? { deviceId: { exact: cameraId } } : {}), width: { max: 1920 }, height: { max: 1080 } },
  }
  try {
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch (err) {
    console.error('[openMediaStream]', err.name, err.message)
    throw err
  }
}
