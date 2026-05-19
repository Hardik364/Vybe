import openMediaStream from './openMediaStream'

export async function getConnectedDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter(d => d.kind === 'videoinput')
}

// Only updates the in-dialog preview — does NOT touch the main stream.
// setStream is intentionally removed; main stream only changes on Apply.
export async function changePreviewCam(deviceId, videoPreviewRef) {
  try {
    const stream = await openMediaStream(deviceId, false)
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream
  } catch (err) {
    console.error('[changePreviewCam]', err)
  }
}

export async function changeCam(setOverlay, deviceId, localVideoRef, setStream, peerConnection) {
  if (!deviceId) return
  try {
    const stream = await openMediaStream(deviceId, false)
    if (localVideoRef?.current) localVideoRef.current.srcObject = stream
    setStream(stream)

    if (peerConnection) {
      const senders = peerConnection.getSenders()
      const videoSender = senders.find(s => s.track?.kind === 'video')
      const videoTrack = stream.getVideoTracks()[0]
      if (videoSender && videoTrack) await videoSender.replaceTrack(videoTrack)
    }
    setOverlay(false)
  } catch (err) {
    console.error('[changeCam]', err)
  }
}
