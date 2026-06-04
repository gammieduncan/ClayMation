import { useEffect, useRef, useState } from 'react'
import { useWebcam } from '../hooks/useWebcam'
import { canExportAudio, canExportMp4, exportMp4 } from '../lib/exportMp4'
import type { Frame } from '../types'
import { AudioTrack } from './AudioTrack'
import { Filmstrip } from './Filmstrip'

type Mode = 'live' | 'preview' | 'play'

interface Dims {
  w: number
  h: number
}

const ONION_MAX = 5

export function Studio() {
  const { devices, deviceId, setDeviceId, stream, error } = useWebcam()

  const [frames, setFrames] = useState<Frame[]>([])
  const [fps, setFps] = useState(12)
  const [onionEnabled, setOnionEnabled] = useState(true)
  const [onionCount, setOnionCount] = useState(3)
  const [mode, setMode] = useState<Mode>('live')
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [dims, setDims] = useState<Dims>({ w: 1280, h: 720 })
  const [isExporting, setIsExporting] = useState(false)
  const [exportPct, setExportPct] = useState(0)
  const [audio, setAudio] = useState<{ name: string; buffer: AudioBuffer; source: 'import' | 'record' } | null>(null)
  const [audioMenuOpen, setAudioMenuOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioMenuRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const recordStreamRef = useRef<MediaStream | null>(null)
  const recordTimerRef = useRef<number | null>(null)
  const playRef = useRef({ index: 0, last: 0 })

  // Mirror reactive state into a ref so the rAF loop always reads fresh values.
  const stateRef = useRef({ frames, fps, onionEnabled, onionCount, mode, previewIndex, dims })
  stateRef.current = { frames, fps, onionEnabled, onionCount, mode, previewIndex, dims }

  // Attach the camera stream to the (hidden) video element.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => {})
  }, [stream])

  // The render loop: live feed + onion ghosts, or a preview/playback frame.
  useEffect(() => {
    let raf = 0
    const draw = (ts: number) => {
      const canvas = canvasRef.current
      const video = videoRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        const s = stateRef.current
        const { w, h } = s.dims
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }

        if (s.mode === 'play' && s.frames.length > 0) {
          const p = playRef.current
          if (ts - p.last >= 1000 / s.fps) {
            p.last = ts
            p.index = (p.index + 1) % s.frames.length
          }
          ctx.globalAlpha = 1
          ctx.drawImage(s.frames[p.index].bitmap, 0, 0, w, h)
        } else if (s.mode === 'preview' && s.previewIndex != null && s.frames[s.previewIndex]) {
          ctx.globalAlpha = 1
          ctx.drawImage(s.frames[s.previewIndex].bitmap, 0, 0, w, h)
        } else {
          // Live: current camera frame, then translucent ghosts of recent shots.
          if (video && video.readyState >= 2) {
            ctx.globalAlpha = 1
            ctx.drawImage(video, 0, 0, w, h)
          }
          if (s.onionEnabled && s.frames.length > 0) {
            let alpha = 0.5
            const start = s.frames.length - 1
            const end = Math.max(0, s.frames.length - s.onionCount)
            for (let k = start; k >= end; k--) {
              ctx.globalAlpha = alpha
              ctx.drawImage(s.frames[k].bitmap, 0, 0, w, h)
              alpha *= 0.5
            }
            ctx.globalAlpha = 1
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  function stopAudio() {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop()
      } catch {
        /* already stopped */
      }
      audioSourceRef.current.disconnect()
      audioSourceRef.current = null
    }
  }

  // Play the music alongside in-page playback; stop it otherwise.
  useEffect(() => {
    if (mode !== 'play' || !audio) {
      stopAudio()
      return
    }
    const ctx = (audioCtxRef.current ??= new AudioContext())
    ctx.resume().catch(() => {})
    stopAudio()
    const src = ctx.createBufferSource()
    src.buffer = audio.buffer
    src.loop = true
    src.connect(ctx.destination)
    src.start()
    audioSourceRef.current = src
    return stopAudio
  }, [mode, audio])

  async function handleAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    try {
      const ctx = (audioCtxRef.current ??= new AudioContext())
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
      setAudio({ name: file.name, buffer, source: 'import' })
    } catch {
      alert('Could not read that audio file. Try an MP3, WAV, or M4A.')
    }
  }

  function removeAudio() {
    stopAudio()
    setAudio(null)
  }

  async function startRecording() {
    setAudioMenuOpen(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStreamRef.current = stream
      recordChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        recordStreamRef.current?.getTracks().forEach((t) => t.stop())
        recordStreamRef.current = null
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType })
        try {
          const ctx = (audioCtxRef.current ??= new AudioContext())
          const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
          setAudio({ name: 'Recording', buffer, source: 'record' })
        } catch {
          alert('Could not decode the recording.')
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch {
      alert('Could not access the microphone. Grant permission and try again.')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setIsRecording(false)
    if (recordTimerRef.current !== null) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
  }

  // Close the audio menu when clicking outside it.
  useEffect(() => {
    if (!audioMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setAudioMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [audioMenuOpen])

  function handleLoadedMetadata() {
    const v = videoRef.current
    if (v && v.videoWidth) setDims({ w: v.videoWidth, h: v.videoHeight })
  }

  function makeThumb(video: HTMLVideoElement): string {
    const tw = 200
    const th = Math.round((tw * video.videoHeight) / video.videoWidth) || 112
    const c = document.createElement('canvas')
    c.width = tw
    c.height = th
    c.getContext('2d')!.drawImage(video, 0, 0, tw, th)
    return c.toDataURL('image/jpeg', 0.6)
  }

  async function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const bitmap = await createImageBitmap(video)
    const thumb = makeThumb(video)
    setFrames((prev) => [...prev, { id: crypto.randomUUID(), bitmap, thumb }])
    setMode('live')
    setPreviewIndex(null)
  }

  function togglePlay() {
    if (mode === 'play') {
      setMode('live')
    } else if (frames.length > 0) {
      playRef.current = { index: 0, last: performance.now() }
      setPreviewIndex(null)
      setMode('play')
    }
  }

  function selectFrame(i: number) {
    setPreviewIndex(i)
    setMode('preview')
  }

  function deleteFrame(i: number) {
    setFrames((prev) => {
      prev[i]?.bitmap.close()
      return prev.filter((_, idx) => idx !== i)
    })
    setMode('live')
    setPreviewIndex(null)
  }

  function goLive() {
    setMode('live')
    setPreviewIndex(null)
  }

  // Move a frame so it lands at index `to`, shifting the rest. Keeps the
  // currently previewed frame highlighted by following its new position.
  function reorderFrames(from: number, to: number) {
    if (from === to) return
    setFrames((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setPreviewIndex((p) => {
      if (p === null) return p
      if (p === from) return to
      let np = p > from ? p - 1 : p
      if (np >= to) np += 1
      return np
    })
  }

  async function handleExport() {
    if (frames.length === 0) return
    setIsExporting(true)
    setExportPct(0)
    try {
      const blob = await exportMp4({
        frames,
        fps,
        width: dims.w,
        height: dims.h,
        audio: audio?.buffer ?? null,
        onProgress: (d, t) => setExportPct(d / t),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `claymation-${frames.length}f-${fps}fps.mp4`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setIsExporting(false)
      setExportPct(0)
    }
  }

  const durationSec = frames.length / fps
  const exportSupported = canExportMp4()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-400 text-lg font-black text-black">C</span>
          <div className="leading-tight">
            <div className="font-semibold">ClayMation</div>
            <div className="text-xs text-white/40">webcam stop-motion studio</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-white/40">Camera</label>
          <select
            value={deviceId ?? ''}
            onChange={(e) => setDeviceId(e.target.value)}
            className="max-w-[220px] truncate rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
          >
            {devices.length === 0 && <option value="">Default camera</option>}
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId} className="bg-neutral-900">
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Stage */}
      <main className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
        {error ? (
          <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <div className="mb-1 font-semibold text-red-300">Camera unavailable</div>
            <div className="text-sm text-white/60">{error}</div>
            <div className="mt-2 text-xs text-white/40">Grant camera permission and reload.</div>
          </div>
        ) : (
          <div className="relative w-full max-w-3xl">
            <canvas
              ref={canvasRef}
              className="aspect-video w-full rounded-2xl bg-black ring-1 ring-white/10"
            />
            {mode !== 'live' && (
              <button
                onClick={goLive}
                className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur hover:bg-black"
              >
                ‹ Back to live
              </button>
            )}
            <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
              {mode === 'play' ? 'Playing' : mode === 'preview' ? `Frame ${(previewIndex ?? 0) + 1}` : 'Live'}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex w-full max-w-3xl flex-wrap items-center justify-center gap-3">
          <button
            onClick={capture}
            disabled={!!error}
            className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-40"
          >
            <span className="h-3 w-3 rounded-full bg-black" /> Capture
          </button>

          <button
            onClick={togglePlay}
            disabled={frames.length === 0}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-medium transition hover:bg-white/10 disabled:opacity-40"
          >
            {mode === 'play' ? '■ Stop' : '▶ Play'}
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5">
            <label className="text-xs text-white/50">FPS</label>
            <input
              type="number"
              min={1}
              max={60}
              value={fps}
              onChange={(e) => setFps(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
              className="w-12 bg-transparent text-center text-sm outline-none"
            />
          </div>

          <button
            onClick={() => setOnionEnabled((v) => !v)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
              onionEnabled
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'
            }`}
            title="Show translucent ghosts of recent frames to line up your next shot"
          >
            Onion skin
          </button>
          {onionEnabled && (
            <input
              type="range"
              min={1}
              max={ONION_MAX}
              value={onionCount}
              onChange={(e) => setOnionCount(Number(e.target.value))}
              className="w-24 accent-amber-400"
              title={`${onionCount} ghost frame(s)`}
            />
          )}

          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-2.5 font-medium text-red-300 transition hover:bg-red-500/25"
            >
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              Stop · {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
            </button>
          ) : (
            <div className="relative" ref={audioMenuRef}>
              <button
                onClick={() => setAudioMenuOpen((o) => !o)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-medium text-white/70 transition hover:bg-white/10"
                title="Add audio to play during preview and bake into the export"
              >
                ♪ Audio ▾
              </button>
              {audioMenuOpen && (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-44 overflow-hidden rounded-xl border border-white/15 bg-neutral-900 shadow-xl">
                  <button
                    onClick={() => {
                      setAudioMenuOpen(false)
                      audioInputRef.current?.click()
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-white/10"
                  >
                    ⤓ Import file…
                  </button>
                  <button
                    onClick={startRecording}
                    className="flex w-full items-center gap-2 border-t border-white/10 px-4 py-2.5 text-left text-sm hover:bg-white/10"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Record
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mx-1 h-6 w-px bg-white/10" />

          <button
            onClick={handleExport}
            disabled={frames.length === 0 || isExporting || !exportSupported}
            className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2.5 font-medium text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-40"
            title={exportSupported ? 'Encode an MP4 in your browser' : 'This browser lacks WebCodecs MP4 support'}
          >
            {isExporting ? `Encoding ${Math.round(exportPct * 100)}%` : '⤓ Export MP4'}
          </button>
        </div>

        <div className="text-xs text-white/40">
          {frames.length} frame{frames.length === 1 ? '' : 's'} · {durationSec.toFixed(1)}s at {fps} fps
          {!exportSupported && <span className="ml-2 text-amber-300/70">(MP4 export needs Chrome/Edge or Safari 16.4+)</span>}
          {audio && exportSupported && !canExportAudio() && (
            <span className="ml-2 text-amber-300/70">(music plays here but can't be baked into the MP4 in this browser)</span>
          )}
        </div>
      </main>

      <Filmstrip
        frames={frames}
        activeIndex={mode === 'preview' ? previewIndex : null}
        onSelect={selectFrame}
        onDelete={deleteFrame}
        onReorder={reorderFrames}
      />

      {audio && (
        <AudioTrack
          buffer={audio.buffer}
          name={audio.name}
          source={audio.source}
          onRemove={removeAudio}
        />
      )}

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioFile}
        className="hidden"
      />

      {/* Hidden source video — drawn into the canvas every frame. */}
      <video
        ref={videoRef}
        onLoadedMetadata={handleLoadedMetadata}
        muted
        playsInline
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
    </div>
  )
}
