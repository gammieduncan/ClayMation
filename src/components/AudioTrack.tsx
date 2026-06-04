import { useEffect, useRef } from 'react'

interface Props {
  buffer: AudioBuffer
  name: string
  source: 'import' | 'record'
  onRemove: () => void
}

/** A timeline lane that renders the audio waveform with a label and remove button. */
export function AudioTrack({ buffer, name, source, onRemove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    canvas.width = Math.max(1, Math.floor(cssW * dpr))
    canvas.height = Math.max(1, Math.floor(cssH * dpr))
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, cssW, cssH)

    const data = buffer.getChannelData(0)
    const mid = cssH / 2
    const barW = 2
    const gap = 1
    const bars = Math.max(1, Math.floor(cssW / (barW + gap)))
    const step = Math.floor(data.length / bars) || 1

    ctx.fillStyle = '#fbbf24' // amber-400
    for (let b = 0; b < bars; b++) {
      let peak = 0
      const start = b * step
      for (let i = 0; i < step; i++) {
        const v = Math.abs(data[start + i] || 0)
        if (v > peak) peak = v
      }
      const h = Math.max(1, peak * (cssH - 4))
      ctx.fillRect(b * (barW + gap), mid - h / 2, barW, h)
    }
  }, [buffer])

  const mins = Math.floor(buffer.duration / 60)
  const secs = Math.floor(buffer.duration % 60)

  return (
    <div className="flex items-center gap-3 border-t border-white/10 bg-black/20 px-3 py-2">
      <div className="flex w-20 shrink-0 flex-col">
        <span className="text-xs font-medium text-white/70">Audio</span>
        <span className="text-[10px] uppercase tracking-wide text-white/35">
          {source === 'record' ? '● recorded' : 'imported'}
        </span>
      </div>
      <div className="relative h-12 flex-1 overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
        <canvas ref={canvasRef} className="h-full w-full" />
        <span className="absolute left-2 top-1 max-w-[60%] truncate text-[11px] text-white/60" title={name}>
          {name}
        </span>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-white/40">
        {mins}:{String(secs).padStart(2, '0')}
      </span>
      <button
        onClick={onRemove}
        className="shrink-0 rounded-md px-2 py-1 text-sm text-white/40 hover:bg-white/10 hover:text-red-400"
        aria-label="Remove audio"
      >
        ×
      </button>
    </div>
  )
}
