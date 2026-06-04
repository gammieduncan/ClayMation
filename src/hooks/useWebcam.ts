import { useEffect, useState } from 'react'

export interface WebcamState {
  devices: MediaDeviceInfo[]
  deviceId: string | undefined
  setDeviceId: (id: string) => void
  stream: MediaStream | null
  error: string | undefined
}

/**
 * Manages webcam access via getUserMedia. Requests the camera, exposes the
 * available video inputs (labels only populate after permission is granted),
 * and re-acquires the stream when the selected device changes.
 */
export function useWebcam(): WebcamState {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let active = true
    let acquired: MediaStream | null = null

    async function start() {
      try {
        const video: MediaTrackConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
        if (deviceId) video.deviceId = { exact: deviceId }

        acquired = await navigator.mediaDevices.getUserMedia({ video, audio: false })
        if (!active) {
          acquired.getTracks().forEach((t) => t.stop())
          return
        }
        setStream(acquired)
        setError(undefined)

        // Labels are only available once permission has been granted.
        const all = await navigator.mediaDevices.enumerateDevices()
        const cams = all.filter((d) => d.kind === 'videoinput')
        if (!active) return
        setDevices(cams)
        if (!deviceId && cams[0]) setDeviceId(cams[0].deviceId)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not access the camera')
      }
    }

    start()
    return () => {
      active = false
      acquired?.getTracks().forEach((t) => t.stop())
    }
  }, [deviceId])

  return { devices, deviceId, setDeviceId, stream, error }
}
