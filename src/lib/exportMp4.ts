import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { Frame } from '../types'

/** True if this browser can encode H.264 video in-page via WebCodecs. */
export function canExportMp4(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window
}

/** True if this browser can also encode AAC audio (to mux a music track in). */
export function canExportAudio(): boolean {
  return typeof window !== 'undefined' && 'AudioEncoder' in window && 'AudioData' in window
}

interface ExportOptions {
  frames: Frame[]
  fps: number
  width: number
  height: number
  /** Optional music track, trimmed/looped to the clip length and muxed in. */
  audio?: AudioBuffer | null
  onProgress?: (done: number, total: number) => void
}

/**
 * Encode the captured frames (and optional audio) into an H.264/AAC MP4 entirely
 * client-side using WebCodecs, muxed with mp4-muxer. Returns a downloadable Blob.
 */
export async function exportMp4({
  frames,
  fps,
  width,
  height,
  audio,
  onProgress,
}: ExportOptions): Promise<Blob> {
  if (!canExportMp4()) {
    throw new Error('This browser does not support in-page MP4 export (WebCodecs).')
  }
  if (frames.length === 0) {
    throw new Error('Nothing to export — capture some frames first.')
  }

  const w = width - (width % 2)
  const h = height - (height % 2)
  const clipDurationSec = frames.length / fps
  const withAudio = !!audio && canExportAudio()
  const audioChannels = withAudio ? Math.min(audio!.numberOfChannels, 2) : 0

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h },
    ...(withAudio
      ? { audio: { codec: 'aac', sampleRate: audio!.sampleRate, numberOfChannels: audioChannels } }
      : {}),
    fastStart: 'in-memory',
  })

  // --- Video ---
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e),
  })
  videoEncoder.configure({
    codec: 'avc1.42001f', // H.264 baseline, level 3.1
    width: w,
    height: h,
    bitrate: 6_000_000,
    framerate: fps,
  })

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  const frameDurationUs = 1_000_000 / fps
  const keyEvery = Math.max(1, Math.round(fps))

  for (let i = 0; i < frames.length; i++) {
    ctx.drawImage(frames[i].bitmap, 0, 0, w, h)
    const videoFrame = new VideoFrame(canvas, {
      timestamp: Math.round(i * frameDurationUs),
      duration: Math.round(frameDurationUs),
    })
    videoEncoder.encode(videoFrame, { keyFrame: i % keyEvery === 0 })
    videoFrame.close()
    onProgress?.(i + 1, frames.length)
  }
  await videoEncoder.flush()
  videoEncoder.close()

  // --- Audio (optional): trim/encode to the clip length ---
  if (withAudio) {
    await encodeAudio(muxer, audio!, audioChannels, clipDurationSec)
  }

  muxer.finalize()
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}

async function encodeAudio(
  muxer: Muxer<ArrayBufferTarget>,
  buffer: AudioBuffer,
  channels: number,
  maxDurationSec: number,
) {
  const sampleRate = buffer.sampleRate
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => console.error('AudioEncoder error:', e),
  })
  audioEncoder.configure({
    codec: 'mp4a.40.2', // AAC-LC
    sampleRate,
    numberOfChannels: channels,
    bitrate: 128_000,
  })

  const totalFrames = Math.min(buffer.length, Math.floor(maxDurationSec * sampleRate))
  const channelData: Float32Array[] = []
  for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c))

  const chunkFrames = 1024
  for (let offset = 0; offset < totalFrames; offset += chunkFrames) {
    const n = Math.min(chunkFrames, totalFrames - offset)
    // f32-planar layout: all of channel 0, then all of channel 1, ...
    const data = new Float32Array(n * channels)
    for (let c = 0; c < channels; c++) {
      data.set(channelData[c].subarray(offset, offset + n), c * n)
    }
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: n,
      numberOfChannels: channels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data,
    })
    audioEncoder.encode(audioData)
    audioData.close()
  }

  await audioEncoder.flush()
  audioEncoder.close()
}
