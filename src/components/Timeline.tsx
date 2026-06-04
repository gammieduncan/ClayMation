import { useEffect, useRef } from 'react'
import type { Frame } from '../types'
import {
  type AudioClip,
  MIN_CLIP_DURATION,
  audioTimelineEnd,
  clipEnd,
  formatTime,
} from '../lib/audioTimeline'

const RULER_H = 26
const FRAME_LANE_H = 96
const AUDIO_LANE_H = 68
const GUTTER_W = 88
const TOTAL_H = RULER_H + FRAME_LANE_H + AUDIO_LANE_H
const EDGE = 8 // trim-handle width in px

interface Props {
  frames: Frame[]
  fps: number
  pxPerSecond: number
  zoom: number
  minZoom: number
  maxZoom: number
  clips: AudioClip[]
  selectedClipId: string | null
  recording: { analyser: AnalyserNode; startTime: number } | null
  playheadRef: React.RefObject<HTMLDivElement | null>
  onZoom: (z: number) => void
  onScrub: (t: number) => void
  onSelectFrame: (index: number) => void
  onDeleteFrame: (index: number) => void
  onReorderFrames: (from: number, to: number) => void
  onSelectClip: (id: string | null) => void
  onUpdateClip: (id: string, patch: Partial<AudioClip>) => void
  onSplit: () => void
  onDeleteClip: () => void
  onRemoveAudio: () => void
}

function tickInterval(pxPerSecond: number): number {
  const targets = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  for (const t of targets) if (t * pxPerSecond >= 64) return t
  return 1200
}

export function Timeline({
  frames,
  fps,
  pxPerSecond,
  zoom,
  minZoom,
  maxZoom,
  clips,
  selectedClipId,
  recording,
  playheadRef,
  onZoom,
  onScrub,
  onSelectFrame,
  onDeleteFrame,
  onReorderFrames,
  onSelectClip,
  onUpdateClip,
  onSplit,
  onDeleteClip,
  onRemoveAudio,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragIndex = useRef<number | null>(null)
  const scrubbing = useRef(false)

  const hasAudio = clips.length > 0
  const framesDuration = frames.length / fps
  const audioEnd = audioTimelineEnd(clips)
  const recEnd = recording ? recording.startTime + 0.1 : 0
  const totalDuration = Math.max(framesDuration, audioEnd, recEnd, 1)
  const contentWidth = Math.max(totalDuration * pxPerSecond, 1)
  const frameWidth = pxPerSecond / fps

  function timeFromEvent(e: React.PointerEvent | React.MouseEvent): number {
    const el = scrollRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left + el.scrollLeft
    return Math.max(0, Math.min(totalDuration, x / pxPerSecond))
  }

  const interval = tickInterval(pxPerSecond)
  const showTenths = interval < 1
  const ticks: number[] = []
  for (let t = 0; t <= totalDuration + 1e-6; t += interval) ticks.push(t)

  return (
    <div className="shrink-0 border-t border-white/10 bg-neutral-950/60">
      {/* Controls bar */}
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="text-xs text-white/40">Zoom</span>
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          className="w-40 accent-amber-400"
          title="Shrink or stretch the timeline"
        />
        <button
          onClick={() => onZoom(1)}
          className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:bg-white/10"
          title="Reset zoom to frame size"
        >
          Fit
        </button>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {hasAudio ? (
          <>
            <button
              onClick={onSplit}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
              title="Split the audio at the playhead"
            >
              ✂ Split
            </button>
            <button
              onClick={onDeleteClip}
              disabled={!selectedClipId}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-40"
              title="Delete the selected segment (or press Delete)"
            >
              🗑 Delete part
            </button>
            <button
              onClick={onRemoveAudio}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/50 hover:bg-white/10"
              title="Remove all audio"
            >
              Remove audio
            </button>
          </>
        ) : (
          <span className="text-xs text-white/30">Add audio to edit it on the timeline</span>
        )}

        <span className="ml-auto text-xs tabular-nums text-white/40">{formatTime(totalDuration)} total</span>
      </div>

      {/* Tracks */}
      <div className="flex">
        {/* Left gutter with track labels */}
        <div className="shrink-0 border-r border-white/10" style={{ width: GUTTER_W }}>
          <div style={{ height: RULER_H }} />
          <div
            className="flex items-center border-t border-white/5 px-3 text-xs font-medium text-white/60"
            style={{ height: FRAME_LANE_H }}
          >
            Frames
          </div>
          <div
            className="flex items-center border-t border-white/5 px-3 text-xs font-medium text-white/60"
            style={{ height: AUDIO_LANE_H }}
          >
            Audio
          </div>
        </div>

        {/* Scrollable timeline content */}
        <div ref={scrollRef} className="relative flex-1 overflow-x-auto">
          <div className="relative" style={{ width: contentWidth, height: TOTAL_H }}>
            {/* Ruler — drag to scrub */}
            <div
              className="absolute left-0 top-0 cursor-ew-resize select-none border-b border-white/10 bg-neutral-900/40"
              style={{ width: contentWidth, height: RULER_H }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                scrubbing.current = true
                onScrub(timeFromEvent(e))
              }}
              onPointerMove={(e) => {
                if (scrubbing.current) onScrub(timeFromEvent(e))
              }}
              onPointerUp={(e) => {
                scrubbing.current = false
                e.currentTarget.releasePointerCapture(e.pointerId)
              }}
            >
              {ticks.map((t, i) => (
                <div key={i} className="absolute top-0" style={{ left: t * pxPerSecond }}>
                  <div className="h-2 w-px bg-white/25" />
                  <div className="absolute left-1 top-1 text-[10px] tabular-nums text-white/40">
                    {formatTime(t, showTenths)}
                  </div>
                </div>
              ))}
            </div>

            {/* Frames lane */}
            <div
              className="absolute left-0 flex items-center"
              style={{ top: RULER_H, height: FRAME_LANE_H, width: contentWidth }}
            >
              {frames.map((frame, i) => (
                <div
                  key={frame.id}
                  draggable
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex.current !== null && dragIndex.current !== i)
                      onReorderFrames(dragIndex.current, i)
                    dragIndex.current = null
                  }}
                  onClick={() => onSelectFrame(i)}
                  className="group relative h-[80px] shrink-0 cursor-pointer overflow-hidden border-r border-black/40 hover:ring-2 hover:ring-inset hover:ring-amber-400/60"
                  style={{ width: Math.max(2, frameWidth) }}
                  title={`Frame ${i + 1}`}
                >
                  <img src={frame.thumb} alt={`Frame ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
                  {frameWidth >= 28 && (
                    <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[9px] text-white/80">{i + 1}</span>
                  )}
                  {frameWidth >= 40 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteFrame(i)
                      }}
                      className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white/90 hover:bg-red-500 group-hover:flex"
                      aria-label={`Delete frame ${i + 1}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {frames.length === 0 && (
                <span className="px-3 text-xs text-white/30">Capture frames to fill the timeline</span>
              )}
            </div>

            {/* Audio lane */}
            <div
              className="absolute left-0 border-t border-white/5 bg-black/20"
              style={{ top: RULER_H + FRAME_LANE_H, height: AUDIO_LANE_H, width: contentWidth }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  onSelectClip(null)
                  onScrub(timeFromEvent(e))
                }
              }}
            >
              {clips.map((c) => (
                <ClipBlock
                  key={c.id}
                  clip={c}
                  pxPerSecond={pxPerSecond}
                  height={AUDIO_LANE_H}
                  selected={c.id === selectedClipId}
                  onSelect={() => onSelectClip(c.id)}
                  onUpdate={(patch) => onUpdateClip(c.id, patch)}
                />
              ))}
              {recording && (
                <RecordingClip
                  analyser={recording.analyser}
                  startTime={recording.startTime}
                  pxPerSecond={pxPerSecond}
                  height={AUDIO_LANE_H}
                />
              )}
            </div>

            {/* Playhead (positioned imperatively by Studio's render loop) */}
            <div
              ref={playheadRef}
              className="pointer-events-none absolute top-0 z-10 w-0.5 bg-amber-400"
              style={{ height: TOTAL_H, left: 0 }}
            >
              <div className="absolute -left-[3px] -top-[1px] h-2 w-2 rounded-full bg-amber-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

interface ClipBlockProps {
  clip: AudioClip
  pxPerSecond: number
  height: number
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<AudioClip>) => void
}

function ClipBlock({ clip, pxPerSecond, height, selected, onSelect, onUpdate }: ClipBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const interaction = useRef<{ type: 'move' | 'left' | 'right'; startX: number; origin: AudioClip } | null>(null)
  const width = Math.max(2, clip.duration * pxPerSecond)
  const bufDur = clip.buffer.duration

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext('2d')
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    canvas.width = Math.max(1, Math.floor(cssW * dpr))
    canvas.height = Math.max(1, Math.floor(cssH * dpr))
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, cssW, cssH)

    const data = clip.buffer.getChannelData(0)
    const sr = clip.buffer.sampleRate
    const startSample = Math.floor(clip.sourceStart * sr)
    const sampleCount = Math.floor(clip.duration * sr)
    const mid = cssH / 2
    const barW = 2
    const gap = 1
    const bars = Math.max(1, Math.floor(cssW / (barW + gap)))
    const step = Math.max(1, Math.floor(sampleCount / bars))

    c.fillStyle = selected ? '#fde68a' : '#f59e0b'
    for (let b = 0; b < bars; b++) {
      let peak = 0
      const base = startSample + b * step
      for (let i = 0; i < step; i++) {
        const v = Math.abs(data[base + i] || 0)
        if (v > peak) peak = v
      }
      const h = Math.max(1, peak * (cssH - 6))
      c.fillRect(b * (barW + gap), mid - h / 2, barW, h)
    }
  }, [clip.buffer, clip.sourceStart, clip.duration, pxPerSecond, selected])

  function begin(type: 'move' | 'left' | 'right', e: React.PointerEvent) {
    e.stopPropagation()
    onSelect()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    interaction.current = { type, startX: e.clientX, origin: { ...clip } }
  }

  function move(e: React.PointerEvent) {
    const it = interaction.current
    if (!it) return
    const dt = (e.clientX - it.startX) / pxPerSecond
    const o = it.origin
    if (it.type === 'move') {
      onUpdate({ timelineStart: Math.max(0, o.timelineStart + dt) })
    } else if (it.type === 'right') {
      const nd = clamp(o.duration + dt, MIN_CLIP_DURATION, bufDur - o.sourceStart)
      onUpdate({ duration: nd })
    } else {
      let ns = clamp(o.sourceStart + dt, 0, o.sourceStart + o.duration - MIN_CLIP_DURATION)
      let delta = ns - o.sourceStart
      if (o.timelineStart + delta < 0) {
        delta = -o.timelineStart
        ns = o.sourceStart + delta
      }
      onUpdate({ sourceStart: ns, timelineStart: o.timelineStart + delta, duration: o.duration - delta })
    }
  }

  function end(e: React.PointerEvent) {
    interaction.current = null
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  }

  return (
    <div
      className={`absolute top-1 cursor-grab touch-none overflow-hidden rounded-md active:cursor-grabbing ${
        selected ? 'ring-2 ring-amber-300' : 'ring-1 ring-white/15'
      }`}
      style={{ left: clip.timelineStart * pxPerSecond, width, height: height - 8 }}
      onPointerDown={(e) => begin('move', e)}
      onPointerMove={move}
      onPointerUp={end}
      title={`${formatTime(clip.timelineStart)} – ${formatTime(clipEnd(clip))}`}
    >
      <div className={`absolute inset-0 ${selected ? 'bg-amber-400/20' : 'bg-amber-400/10'}`} />
      <canvas ref={canvasRef} className="relative h-full w-full" />

      {/* Trim handles */}
      <div
        className="absolute inset-y-0 left-0 cursor-ew-resize touch-none bg-amber-300/40 hover:bg-amber-300/70"
        style={{ width: EDGE }}
        onPointerDown={(e) => begin('left', e)}
        onPointerMove={move}
        onPointerUp={end}
      />
      <div
        className="absolute inset-y-0 right-0 cursor-ew-resize touch-none bg-amber-300/40 hover:bg-amber-300/70"
        style={{ width: EDGE }}
        onPointerDown={(e) => begin('right', e)}
        onPointerMove={move}
        onPointerUp={end}
      />
    </div>
  )
}

interface RecordingClipProps {
  analyser: AnalyserNode
  startTime: number
  pxPerSecond: number
  height: number
}

function RecordingClip({ analyser, startTime, pxPerSecond, height }: RecordingClipProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peaks = useRef<number[]>([])

  useEffect(() => {
    peaks.current = []
    const startPerf = performance.now()
    const data = new Float32Array(analyser.fftSize)
    let raf = 0
    const tick = () => {
      analyser.getFloatTimeDomainData(data)
      let p = 0
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i])
        if (v > p) p = v
      }
      peaks.current.push(p)

      const elapsed = (performance.now() - startPerf) / 1000
      const w = Math.max(2, elapsed * pxPerSecond)
      const cssH = height - 8
      if (wrapRef.current) wrapRef.current.style.width = `${w}px`
      const canvas = canvasRef.current
      if (canvas) {
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.max(1, Math.floor(w * dpr))
        canvas.height = Math.max(1, Math.floor(cssH * dpr))
        const c = canvas.getContext('2d')
        if (c) {
          c.setTransform(dpr, 0, 0, dpr, 0, 0)
          c.clearRect(0, 0, w, cssH)
          c.fillStyle = '#f87171' // red-400
          const mid = cssH / 2
          const n = peaks.current.length
          const barW = 2
          const gap = 1
          const bars = Math.max(1, Math.floor(w / (barW + gap)))
          for (let b = 0; b < bars; b++) {
            const pk = peaks.current[Math.floor((b / bars) * n)] || 0
            const h = Math.max(1, pk * (cssH - 4))
            c.fillRect(b * (barW + gap), mid - h / 2, barW, h)
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [analyser, pxPerSecond, height])

  return (
    <div
      ref={wrapRef}
      className="absolute top-1 overflow-hidden rounded-md bg-red-500/10 ring-2 ring-red-400/70"
      style={{ left: startTime * pxPerSecond, height: height - 8 }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
