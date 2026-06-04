/** A region of a source AudioBuffer placed at a position on the timeline. */
export interface AudioClip {
  id: string
  /** This clip's own source audio (one buffer per import/recording). */
  buffer: AudioBuffer
  /** Where this clip starts on the timeline, in seconds. */
  timelineStart: number
  /** Offset into the source buffer, in seconds. */
  sourceStart: number
  /** Length of the clip, in seconds. */
  duration: number
}

export const MIN_CLIP_DURATION = 0.05

export function makeClip(buffer: AudioBuffer, timelineStart: number): AudioClip {
  return { id: crypto.randomUUID(), buffer, timelineStart, sourceStart: 0, duration: buffer.duration }
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
        buffer: c.buffer,
        timelineStart: c.timelineStart,
        sourceStart: c.sourceStart,
        duration: leftDur,
      })
      out.push({
        id: crypto.randomUUID(),
        buffer: c.buffer,
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

/**
 * Mix all clips down to a single timeline-aligned AudioBuffer using an
 * OfflineAudioContext (handles differing sample rates and overlaps), for export.
 */
export async function renderTimeline(
  clips: AudioClip[],
  totalDuration: number,
): Promise<AudioBuffer | null> {
  if (!clips.length || totalDuration <= 0) return null
  const sampleRate = 48000
  const length = Math.max(1, Math.ceil(totalDuration * sampleRate))
  const offline = new OfflineAudioContext(2, length, sampleRate)
  for (const c of clips) {
    const src = offline.createBufferSource()
    src.buffer = c.buffer
    src.connect(offline.destination)
    try {
      src.start(c.timelineStart, c.sourceStart, c.duration)
    } catch {
      /* clip out of range — skip */
    }
  }
  return offline.startRendering()
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
