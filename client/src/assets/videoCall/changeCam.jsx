import React, { useEffect, useRef, useState } from "react";
import { changeCam, getConnectedDevices, changePreviewCam } from "../../utils/changeCamUtils";
import openMediaStream from "../../utils/openMediaStream";

export default function ChangeLocalMediaStream({ peerConnection, localVideo, ChangeCamOverly, setChangeCamOverly, selectedDeviceId, setSelectedDeviceId, setStream }) {
    const [devices, setDevices] = useState([]);
    const videoPreview = useRef(null);

    useEffect(() => {
        if (ChangeCamOverly) {
            let streamInstance = null
            const setup = async () => {
                try {
                    const deviceInstance = await getConnectedDevices()
                    setDevices(deviceInstance)
                    streamInstance = await openMediaStream()
                    if (videoPreview.current) videoPreview.current.srcObject = streamInstance
                    setStream(streamInstance)
                } catch (error) {
                    console.error('[ChangeCam] Failed:', error.name, error.message)
                }
            }
            setup()
            return () => {
                if (streamInstance) streamInstance.getTracks().forEach(t => t.stop())
            }
        }
    }, [ChangeCamOverly]);

    if (!ChangeCamOverly) return null;

    return (
        <div id="changeCamOverlay">
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8, fontWeight: 600 }}>
                📷 Select Camera
            </p>
            <video
                id="videoPreview"
                ref={videoPreview}
                autoPlay playsInline controls={false} muted
                style={{ width: '100%', maxWidth: 280, height: 160, objectFit: 'cover', borderRadius: 'var(--r-md)', marginBottom: 10 }}
            />
            <select
                defaultValue=""
                onChange={e => {
                    changePreviewCam(e.target.value, videoPreview, setStream);
                    setSelectedDeviceId(e.target.value);
                }}
            >
                <option value="" disabled>Choose camera…</option>
                {devices.map((device, i) => (
                    <option key={i} value={device.deviceId}>{device.label || `Camera ${i + 1}`}</option>
                ))}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button id="closeCamBtn" onClick={() => setChangeCamOverly(false)}>
                    ✕ Cancel
                </button>
                <button id="applyCamBtn" onClick={() => changeCam(
                    setChangeCamOverly, selectedDeviceId, localVideo, setStream, peerConnection
                )}>
                    ✅ Apply
                </button>
            </div>
        </div>
    );
}
