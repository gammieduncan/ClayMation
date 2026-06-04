/** A region of the source audio buffer placed at a position on the timeline. */
export interface AudioClip {
  id: string
  /** Where this clip starts on the timeline, in seconds. */
  timelineStart: number
  /** Offset into the source AudioBuffer, in seconds. */
  sourceStart: number
  /** Length of the clip, in seconds. */
  duration: number
}

export function clipEnd(c: AudioClip): number {
  return c.timelineStart + c.duration
}

/** End of the last audio clip on the timeline, in seconds. */
export function audioTimelineEnd(clips: AudioClip[]): number {
  return clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0)
}

/** Split any clip that straddles time `t` into two adjacent clips. */
export function splitClipsAtTime(clips: AudioClip[], t: number): AudioClip[] {
  const eps = 1e-4
  const out: AudioClip[] = []
  for (const c of clips) {
    if (t > c.timelineStart + eps && t < clipEnd(c) - eps) {
      const leftDur = t - c.timelineStart
      out.push({
        id: crypto.randomUUID(),
        timelineStart: c.timelineStart,
        sourceStart: c.sourceStart,
        duration: leftDur,
      })
      out.push({
        id: crypto.randomUUID(),
        timelineStart: t,
        sourceStart: c.sourceStart + leftDur,
        duration: c.duration - leftDur,
      })
    } else {
      out.push(c)
    }
  }
  return out
}

/** Is `t` strictly inside some clip (i.e. a split there would actually cut)? */
export function isSplittableAt(clips: AudioClip[], t: number): boolean {
  const eps = 1e-4
  return clips.some((c) => t > c.timelineStart + eps && t < clipEnd(c) - eps)
}

/**
 * Flatten the clips into a single timeline-aligned AudioBuffer (silence in gaps),
 * for export. Length is clamped to `totalDuration` seconds.
 */
export function renderTimelineToBuffer(
  ctx: BaseAudioContext,
  source: AudioBuffer,
  clips: AudioClip[],
  totalDuration: number,
): AudioBuffer {
  const sr = source.sampleRate
  const channels = source.numberOfChannels
  const length = Math.max(1, Math.ceil(totalDuration * sr))
  const out = ctx.createBuffer(channels, length, sr)

  for (let ch = 0; ch < channels; ch++) {
    const dst = out.getChannelData(ch)
    const src = source.getChannelData(ch)
    for (const c of clips) {
      const dstStart = Math.floor(c.timelineStart * sr)
      const srcStart = Math.floor(c.sourceStart * sr)
      const n = Math.floor(c.duration * sr)
      for (let i = 0; i < n; i++) {
        const di = dstStart + i
        const si = srcStart + i
        if (di >= 0 && di < length && si >= 0 && si < src.length) dst[di] = src[si]
      }
    }
  }
  return out
}

/** Format seconds as m:ss (or m:ss.t when an interval needs sub-second labels). */
export function formatTime(s: number, showTenths = false): string {
  if (s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const base = `${m}:${String(sec).padStart(2, '0')}`
  if (!showTenths) return base
  const tenths = Math.floor((s * 10) % 10)
  return `${base}.${tenths}`
}
