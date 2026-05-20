'use client'
import { useEffect, useRef, useState } from 'react'
import openMediaStream from '@/utils/openMediaStream'
import { getConnectedDevices, changePreviewCam, changeCam } from '@/utils/changeCamUtils'

export default function ChangeCam({ peerConnection, localVideoRef, show, setShow, selectedDeviceId, setSelectedDeviceId, setStream }) {
  const [devices, setDevices] = useState([])
  const previewRef = useRef(null)

  useEffect(() => {
    if (!show) return
    let inst = null
    async function setup() {
      try {
        const devs = await getConnectedDevices()
        setDevices(devs)
        inst = await openMediaStream()
        if (previewRef.current) previewRef.current.srcObject = inst
        // Do NOT call setStream(inst) here. The preview stream is only for
        // the camera-picker dialog. Replacing the main stream at this point
        // would kill the audio-only stream being sent over the peer connection,
        // and Cancel would leave the stranger with no audio.
      } catch (err) { console.error('[ChangeCam]', err) }
    }
    setup()
    return () => { if (inst) inst.getTracks().forEach(t => t.stop()) }
  }, [show])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-over backdrop-blur-xl animate-fade-in">
      <div className="bg-surf border border-bdr rounded-xl p-6 flex flex-col gap-4 w-80 max-w-[calc(100vw-2rem)] shadow-lg animate-pop-in">
        <p className="text-[13px] font-semibold text-t2">📷 Select Camera</p>
        <video
          ref={previewRef}
          autoPlay playsInline muted
          className="w-full h-40 object-cover rounded-md"
        />
        <select
          className="bg-elev border border-bdr rounded-md text-t1 text-[14px] px-3 py-2.5 outline-none"
          defaultValue=""
          onChange={e => {
            // Only updates preview — main stream untouched until Apply.
            changePreviewCam(e.target.value, previewRef)
            setSelectedDeviceId(e.target.value)
          }}
        >
          <option value="" disabled>Choose camera…</option>
          {devices.map((d, i) => (
            <option key={i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
          ))}
        </select>
        <div className="flex gap-2.5">
          <button
            onClick={() => setShow(false)}
            className="flex-1 py-2.5 rounded-md border border-bdr text-t2 text-[14px] font-semibold hover:border-accent hover:text-t1 transition-all"
          >
            ✕ Cancel
          </button>
          <button
            onClick={() => changeCam(setShow, selectedDeviceId, localVideoRef, setStream, peerConnection)}
            className="flex-1 py-2.5 rounded-md bg-accent text-white text-[14px] font-semibold hover:bg-accent-h transition-all"
          >
            ✅ Apply
          </button>
        </div>
      </div>
    </div>
  )
}
