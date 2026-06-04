import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { Frame } from '../types'

/** True if this browser can encode H.264 in-page via WebCodecs. */
export function canExportMp4(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window
}

/**
 * Encode the captured frames into an H.264 MP4 entirely client-side using
 * WebCodecs, muxed with mp4-muxer. Returns a downloadable Blob.
 *
 * Each frame is drawn onto an even-dimensioned canvas first (H.264 requires
 * even width/height) so any camera resolution is safe.
 */
export async function exportMp4(
  frames: Frame[],
  fps: number,
  width: number,
  height: number,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (!canExportMp4()) {
    throw new Error('This browser does not support in-page MP4 export (WebCodecs).')
  }
  if (frames.length === 0) {
    throw new Error('Nothing to export — capture some frames first.')
  }

  const w = width - (width % 2)
  const h = height - (height % 2)

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h },
    fastStart: 'in-memory',
  })

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e),
  })

  encoder.configure({
    codec: 'avc1.42001f', // H.264 baseline, level 3.1
    width: w,
    height: h,
    bitrate: 6_000_000,
    framerate: fps,
  })

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  const frameDurationUs = 1_000_000 / fps

  for (let i = 0; i < frames.length; i++) {
    ctx.drawImage(frames[i].bitmap, 0, 0, w, h)
    const videoFrame = new VideoFrame(canvas, {
      timestamp: Math.round(i * frameDurationUs),
      duration: Math.round(frameDurationUs),
    })
    // A keyframe roughly once per second keeps the file seekable.
    encoder.encode(videoFrame, { keyFrame: i % Math.max(1, Math.round(fps)) === 0 })
    videoFrame.close()
    onProgress?.(i + 1, frames.length)
  }

  await encoder.flush()
  encoder.close()
  muxer.finalize()

  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}
