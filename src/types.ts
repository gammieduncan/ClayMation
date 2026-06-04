/** A single captured stop-motion frame. */
export interface Frame {
  id: string
  /** Full-resolution image used for onion-skinning, playback, and export. */
  bitmap: ImageBitmap
  /** Small JPEG data URL shown in the filmstrip. */
  thumb: string
}
