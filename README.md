# ClayMation

A **webcam stop-motion animation studio** that runs entirely in your browser.
Shoot frames from your camera, line up each shot against translucent onion-skin
ghosts of the previous frames, reorder the timeline by dragging, then export a
real **MP4 — encoded client-side** with WebCodecs. No uploads, no server.

This is a from-scratch web rewrite of the original Java/Swing desktop app
(preserved on the [`desktop-java`](https://github.com/gammieduncan/ClayMation/tree/desktop-java)
tag) — the browser turns out to be the perfect home for it: native webcam
access, GPU-accelerated canvas compositing, and in-page H.264 encoding.

**[▶ Live demo](https://gammieduncan.github.io/claymation-web/)**

## Features

- 🎥 **Live webcam capture** with a camera picker
- 👻 **Onion-skinning** — adjustable translucent ghosts of recent frames to keep motion smooth
- 🎞️ **Drag-to-reorder filmstrip** — rearrange frames, click to preview, delete inline
- ▶️ **In-page playback** at an adjustable frame rate
- ⤓ **Client-side MP4 export** via WebCodecs + [mp4-muxer](https://github.com/Vanilagy/mp4-muxer)

## Tech

React · TypeScript · Vite · Tailwind CSS · WebCodecs · `getUserMedia` · `<canvas>`

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## Browser support

Capture and playback work in any modern browser. **MP4 export requires WebCodecs**
(Chrome/Edge, or Safari 16.4+). The app detects support and disables export with a
note where it's unavailable.
